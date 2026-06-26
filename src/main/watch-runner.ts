import { powerMonitor } from 'electron'
import { join, dirname, basename, extname } from 'path'
import { tmpdir } from 'os'
import { rename, mkdir, readdir, stat, rm, copyFile } from 'fs/promises'
import { randomUUID } from 'crypto'
import { WatchFolder, WatchFileRecord, WatchSchedule, HOLD_DIRNAME } from '@shared/watch'
import { WatchActivity, QueueItem, ProgressEvent, MediaInfo } from '@shared/ipc-contract'
import { Ledger } from './ledger'
import { runJob } from './job-runner'
import { cachedCaps } from './encoder-detect'
import { probe } from './ffprobe'
import { computeFingerprint } from './fingerprint'
import { provenanceValue } from './provenance'
import { resolveOutputPath, DEFAULT_OUTPUT_CONFIG } from './output'

type Emit = (activity: WatchActivity | null) => void
type Changed = () => void

/**
 * Drains queued ledger rows one at a time, gated by each folder's schedule.
 * Validates every output before touching the original, and never hard-deletes.
 */
export class WatchRunner {
  private running = false
  private holdTimer: NodeJS.Timeout | null = null

  constructor(
    private ledger: Ledger,
    private emitActivity: Emit,
    private onChanged: Changed
  ) {}

  start(): void {
    this.ledger.resetStuckProcessing()
    this.scheduleHoldCleanup()
    void this.drain()
  }

  /** Kick the drain loop — called whenever new work is queued. */
  kick(): void {
    void this.drain()
  }

  stop(): void {
    if (this.holdTimer) clearInterval(this.holdTimer)
  }

  private async drain(): Promise<void> {
    if (this.running) return
    this.running = true
    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const folders = this.ledger.listFolders().filter((f) => f.enabled)
        if (!folders.length) break
        const next = this.ledger.nextQueued(folders.map((f) => f.id))
        if (!next) break

        const folder = folders.find((f) => f.id === next.folderId)
        if (!folder) {
          this.ledger.markStatus(next.fingerprint, 'skipped', { reason: 'Folder no longer watched' })
          continue
        }

        // Schedule gate — if this folder isn't allowed to process now, wait and re-check.
        const wait = gateReason(folder.schedule)
        if (wait) {
          this.emitActivity({
            folderId: folder.id,
            fingerprint: next.fingerprint,
            name: next.name,
            progress: null,
            waitingReason: wait
          })
          await sleep(60_000)
          continue
        }

        await this.process(folder, next)
      }
    } finally {
      this.emitActivity(null)
      this.running = false
    }
  }

  private async process(folder: WatchFolder, rec: WatchFileRecord): Promise<void> {
    this.ledger.markStatus(rec.fingerprint, 'processing')
    this.onChanged()

    const srcInfo = await probe(rec.originalPath).catch(() => null)
    if (!srcInfo) {
      this.ledger.markStatus(rec.fingerprint, 'error', { reason: 'Source unreadable (moved or deleted?)' })
      this.onChanged()
      return
    }

    const ext = folder.settings.videoMode === 'none' ? 'm4a' : folder.settings.container
    const tempOut = join(tmpdir(), `frostbyte-watch-${randomUUID()}.${ext}`)
    const provenance = provenanceValue(folder.presetId, srcInfo.sizeBytes, Math.floor(Date.now() / 1000))

    const item: QueueItem = {
      id: randomUUID(),
      info: srcInfo,
      settings: { ...folder.settings },
      rawArgsOverride: null,
      outputPath: tempOut,
      status: 'running',
      progress: null,
      result: null,
      error: null
    }

    const onProgress = (e: ProgressEvent): void => {
      this.emitActivity({
        folderId: folder.id,
        fingerprint: rec.fingerprint,
        name: rec.name,
        progress: e,
        waitingReason: null
      })
    }

    try {
      const result = await runJob(item, cachedCaps(), onProgress, { provenance }).promise

      // --- Validate before replacing (gotcha #2) ---
      const outInfo = await probe(tempOut).catch(() => null)
      // Allow up to 5 s or 1% of source duration, whichever is larger.
      // VFR sources (e.g. Bandicam) re-expressed as CFR can shift container-reported
      // duration by several seconds even when the full content is present.
      const durTolerance = Math.max(5, srcInfo.durationSec * 0.01)
      const durOk = outInfo && Math.abs(outInfo.durationSec - srcInfo.durationSec) <= durTolerance
      const smaller = result.outputSizeBytes > 0 && result.outputSizeBytes < srcInfo.sizeBytes
      if (!outInfo || !durOk || !smaller) {
        await rm(tempOut, { force: true })
        const why = !outInfo
          ? 'Output failed validation (corrupt)'
          : !durOk
            ? 'Output duration mismatch — kept original'
            : 'Compressed file was not smaller — kept original'
        this.ledger.markStatus(rec.fingerprint, 'skipped', { reason: why })
        this.onChanged()
        return
      }

      const finalPath = await this.placeOutput(folder, rec, srcInfo, tempOut)
      const outFp = await computeFingerprint(finalPath, outInfo.durationSec)

      this.ledger.markStatus(rec.fingerprint, 'done', {
        outputPath: finalPath,
        outputFingerprint: outFp,
        outSizeBytes: result.outputSizeBytes,
        savedPercent: result.savedPercent,
        reason: null
      })
      // Also record the output's own fingerprint as done so a rescan of the
      // (keep-mode) output isn't treated as a new file even before its tag is read.
      this.ledger.upsertFile({
        ...rec,
        fingerprint: outFp,
        originalPath: finalPath,
        name: basename(finalPath),
        status: 'done',
        outputPath: finalPath,
        outputFingerprint: outFp,
        outSizeBytes: result.outputSizeBytes,
        savedPercent: result.savedPercent,
        reason: 'Frostbyte output',
        updatedAt: Math.floor(Date.now() / 1000)
      })
      this.onChanged()
    } catch (err) {
      await rm(tempOut, { force: true })
      const msg = err instanceof Error ? err.message : 'Encode failed'
      this.ledger.markStatus(rec.fingerprint, 'error', { reason: msg })
      this.onChanged()
    }
  }

  /**
   * Moves the validated temp output into place per folder mode, then disposes of
   * the original safely if replacing. Never hard-deletes (gotcha #4).
   */
  private async placeOutput(
    folder: WatchFolder,
    rec: WatchFileRecord,
    srcInfo: MediaInfo,
    tempOut: string
  ): Promise<string> {
    const dir = dirname(rec.originalPath)

    if (folder.mode === 'keep') {
      const dest = resolveOutputPath(srcInfo, folder.settings, DEFAULT_OUTPUT_CONFIG)
      await rename(tempOut, dest).catch(async () => {
        // cross-device fallback
        await copyAndRemove(tempOut, dest)
      })
      return dest
    }

    // replace mode — dispose of original first
    if (folder.safeDelete === 'hold') {
      const holdDir = join(dir, HOLD_DIRNAME)
      await mkdir(holdDir, { recursive: true })
      await rename(rec.originalPath, join(holdDir, basename(rec.originalPath))).catch(() => {})
    } else {
      await moveToTrash(rec.originalPath).catch(() => {})
    }

    // Place compressed file at the original's path, but with the target container ext.
    const stem = basename(rec.originalPath, extname(rec.originalPath))
    const dest = join(dir, `${stem}.${folder.settings.container}`)
    await rename(tempOut, dest).catch(async () => {
      await copyAndRemove(tempOut, dest)
    })
    return dest
  }

  // ---- hold cleanup ----

  private scheduleHoldCleanup(): void {
    void this.cleanupHeld()
    this.holdTimer = setInterval(() => void this.cleanupHeld(), 6 * 60 * 60 * 1000) // every 6h
  }

  private async cleanupHeld(): Promise<void> {
    const now = Date.now()
    for (const folder of this.ledger.listFolders()) {
      if (folder.mode !== 'replace' || folder.safeDelete !== 'hold') continue
      const holdDir = join(folder.path, HOLD_DIRNAME)
      let entries: string[]
      try {
        entries = await readdir(holdDir)
      } catch {
        continue
      }
      const maxAgeMs = folder.holdDays * 24 * 60 * 60 * 1000
      for (const name of entries) {
        const p = join(holdDir, name)
        try {
          const st = await stat(p)
          if (now - st.mtimeMs > maxAgeMs) await moveToTrash(p).catch(() => {})
        } catch {
          /* ignore */
        }
      }
    }
  }
}

// ---- schedule gating ----

/** Returns a human reason to wait, or null if processing is allowed right now. */
function gateReason(s: WatchSchedule): string | null {
  if (s.trigger === 'realtime') return null

  if (s.trigger === 'scheduled') {
    if (!s.quietStart || !s.quietEnd) return null
    return inWindow(s.quietStart, s.quietEnd) ? null : `Waiting for quiet hours (${s.quietStart}–${s.quietEnd})`
  }

  // idle
  const idleMin = s.idleMinutes ?? 5
  const idleSec = powerMonitor.getSystemIdleTime()
  if (idleSec < idleMin * 60) return `Waiting for ${idleMin} min of inactivity`
  if (s.requireAcPower && powerMonitor.isOnBatteryPower()) return 'Waiting for AC power'
  return null
}

function inWindow(start: string, end: string): boolean {
  const now = new Date()
  const cur = now.getHours() * 60 + now.getMinutes()
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const s = sh * 60 + sm
  const e = eh * 60 + em
  return s <= e ? cur >= s && cur < e : cur >= s || cur < e // handles overnight windows
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function copyAndRemove(from: string, to: string): Promise<void> {
  await copyFile(from, to)
  await rm(from, { force: true })
}

// `trash` v9 is ESM-only — load it lazily via dynamic import so it works from the
// CommonJS main bundle without ERR_REQUIRE_ESM. Sends a path to the OS Recycle Bin.
async function moveToTrash(path: string): Promise<void> {
  const mod = await import('trash')
  await mod.default(path)
}
