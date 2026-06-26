import chokidar, { FSWatcher } from 'chokidar'
import { readdir } from 'fs/promises'
import { join, extname, basename } from 'path'
import {
  WatchFolder,
  WatchFileRecord,
  INCOMPLETE_EXTENSIONS,
  HOLD_DIRNAME,
  predictSavingsPercent
} from '@shared/watch'
import { Ledger } from './ledger'
import { computeFingerprint } from './fingerprint'
import { readProvenance } from './provenance'
import { probe } from './ffprobe'

const VIDEO_EXTS = new Set([
  '.mp4', '.mov', '.mkv', '.webm', '.avi', '.m4v', '.flv', '.wmv', '.ts', '.mpg', '.mpeg', '.3gp'
])

function isVideo(path: string): boolean {
  return VIDEO_EXTS.has(extname(path).toLowerCase())
}

function isIncomplete(path: string): boolean {
  return INCOMPLETE_EXTENSIONS.includes(extname(path).toLowerCase())
}

type Notify = () => void

/**
 * Owns the chokidar watchers and the per-file decision flow. It never encodes —
 * it only classifies files and records `queued` rows in the ledger, then pings
 * the runner. Detection is cheap and always-on; processing is the runner's job.
 */
export class Watcher {
  private watchers = new Map<string, FSWatcher>()

  constructor(
    private ledger: Ledger,
    private onQueued: Notify,
    private onChanged: Notify
  ) {}

  /** (Re)arm a folder according to its scope. Idempotent. */
  async arm(folder: WatchFolder): Promise<void> {
    this.disarm(folder.id)
    if (!folder.enabled) return

    if (folder.scope === 'futureOnly') {
      await this.baselineExisting(folder)
      this.startWatching(folder)
    } else if (folder.scope === 'existingOnly') {
      await this.sweepExisting(folder)
      // no live watcher — one-time sweep
    } else {
      // existingAndFuture
      await this.sweepExisting(folder)
      this.startWatching(folder)
    }
    this.onChanged()
  }

  disarm(folderId: string): void {
    const w = this.watchers.get(folderId)
    if (w) {
      void w.close()
      this.watchers.delete(folderId)
    }
  }

  closeAll(): void {
    for (const w of this.watchers.values()) void w.close()
    this.watchers.clear()
  }

  // ---- internals ----

  private startWatching(folder: WatchFolder): void {
    const watcher = chokidar.watch(folder.path, {
      depth: 0, // top level of the folder only
      ignoreInitial: true, // initial files handled by sweep/baseline
      awaitWriteFinish: { stabilityThreshold: 30_000, pollInterval: 1000 }, // gotcha #1
      ignored: (p: string) =>
        p.includes(HOLD_DIRNAME) || basename(p).startsWith('.') || isIncomplete(p)
    })
    const onFile = (p: string): void => {
      if (isVideo(p)) void this.consider(folder, p)
    }
    watcher.on('add', onFile)
    watcher.on('change', onFile)
    this.watchers.set(folder.id, watcher)
  }

  /** Record every current file as a permanently-ignored baseline (futureOnly). */
  private async baselineExisting(folder: WatchFolder): Promise<void> {
    for (const p of await this.listVideos(folder.path)) {
      try {
        if (await readProvenance(p)) continue // already ours — skip cleanly
        const info = await probe(p)
        const fp = await computeFingerprint(p, info.durationSec)
        if (this.ledger.getByFingerprint(fp)) continue
        this.ledger.upsertFile(this.record(folder.id, p, info.sizeBytes, fp, 'baseline', 'Pre-existing (future-only)'))
      } catch {
        /* unreadable file — ignore */
      }
    }
  }

  /** Enqueue every current file that passes the decision flow. */
  private async sweepExisting(folder: WatchFolder): Promise<void> {
    for (const p of await this.listVideos(folder.path)) {
      await this.consider(folder, p)
    }
  }

  private async listVideos(dir: string): Promise<string[]> {
    try {
      const entries = await readdir(dir, { withFileTypes: true })
      return entries
        .filter((e) => e.isFile() && isVideo(e.name) && !isIncomplete(e.name) && !e.name.startsWith('.'))
        .map((e) => join(dir, e.name))
    } catch {
      return []
    }
  }

  /**
   * The dedup core. Decide whether `path` is new-to-us and worth compressing.
   *   1. provenance tag present  -> ours, skip
   *   2. fingerprint in ledger   -> known (done/baseline/processing/queued), skip
   *   3. predicted savings low   -> skip (already efficient)
   *   4. otherwise               -> enqueue
   */
  private async consider(folder: WatchFolder, path: string): Promise<void> {
    try {
      if (await readProvenance(path)) return // (1)

      const info = await probe(path)
      const fp = await computeFingerprint(path, info.durationSec)
      if (this.ledger.getByFingerprint(fp)) return // (2)

      const predicted = predictSavingsPercent(folder.settings, info) // (3)
      if (predicted < folder.minSavingsPercent) {
        this.ledger.upsertFile(
          this.record(
            folder.id,
            path,
            info.sizeBytes,
            fp,
            'skipped',
            `Predicted savings ${predicted}% < ${folder.minSavingsPercent}% threshold`
          )
        )
        this.onChanged()
        return
      }

      this.ledger.upsertFile(this.record(folder.id, path, info.sizeBytes, fp, 'queued', null)) // (4)
      this.onChanged()
      this.onQueued()
    } catch {
      /* probe/hash failure (file vanished, still locked) — let a later event retry */
    }
  }

  private record(
    folderId: string,
    path: string,
    sizeBytes: number,
    fingerprint: string,
    status: WatchFileRecord['status'],
    reason: string | null
  ): WatchFileRecord {
    return {
      fingerprint,
      folderId,
      originalPath: path,
      name: basename(path),
      status,
      outputPath: null,
      outputFingerprint: null,
      origSizeBytes: sizeBytes,
      outSizeBytes: null,
      savedPercent: null,
      reason,
      updatedAt: Math.floor(Date.now() / 1000)
    }
  }
}
