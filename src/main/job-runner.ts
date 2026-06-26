import { spawn, ChildProcess, execFile } from 'child_process'
import { tmpdir, constants as osConstants } from 'os'
import { join } from 'path'
import { statSync, existsSync, unlinkSync } from 'fs'
import { ffmpegPath } from './ffmpeg-path'
import { buildFFmpegArgs, effectiveDuration, tokenize } from '@shared/command-builder'
import { bitrateForTargetSize } from '@shared/target-size'
import { ProgressParser } from './progress-parser'
import { EncoderCapabilities } from '@shared/encoders'
import { QueueItem, ProgressEvent, JobResult } from '@shared/ipc-contract'

export interface RunningJob {
  promise: Promise<JobResult>
  cancel: () => void
  suspend: () => void
  resume: () => void
}

function suspendProcess(pid: number): void {
  const cmd =
    `$s='[DllImport("ntdll.dll")] public static extern int NtSuspendProcess(IntPtr h);';` +
    `$t=Add-Type -MemberDefinition $s -Name Ns${pid} -Namespace W -PassThru;` +
    `try{$t::NtSuspendProcess((Get-Process -Id ${pid} -ErrorAction Stop).Handle)}catch{}`
  execFile('powershell', ['-NoProfile', '-NonInteractive', '-Command', cmd], () => {})
}

function resumeProcess(pid: number): void {
  const cmd =
    `$s='[DllImport("ntdll.dll")] public static extern int NtResumeProcess(IntPtr h);';` +
    `$t=Add-Type -MemberDefinition $s -Name Nr${pid} -Namespace W -PassThru;` +
    `try{$t::NtResumeProcess((Get-Process -Id ${pid} -ErrorAction Stop).Handle)}catch{}`
  execFile('powershell', ['-NoProfile', '-NonInteractive', '-Command', cmd], () => {})
}

function spawnFfmpeg(
  args: string[],
  durationSec: number,
  id: string,
  pass: 1 | 2 | undefined,
  onProgress: (e: ProgressEvent) => void,
  lowPriority = false
): { child: ChildProcess; done: Promise<void> } {
  const full = ['-progress', 'pipe:1', '-nostats', ...args]
  const child = spawn(ffmpegPath(), full, { windowsHide: true })
  if (lowPriority && child.pid) {
    try { process.setPriority(child.pid, osConstants.priority.PRIORITY_BELOW_NORMAL) } catch { /* ignore */ }
  }
  const parser = new ProgressParser(id, durationSec, onProgress, pass)
  let stderrTail = ''

  child.stdout?.on('data', (d) => parser.feed(d))
  child.stderr?.on('data', (d) => {
    stderrTail = (stderrTail + d.toString()).slice(-4096)
  })

  const done = new Promise<void>((resolve, reject) => {
    child.on('error', (e) => reject(new Error(e.message)))
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(extractError(stderrTail, code)))
    })
  })
  return { child, done }
}

/**
 * Pulls the most useful line out of ffmpeg's stderr tail. Prefers lines that
 * look like real errors over benign muxer noise (e.g. two-pass "non monotonically
 * increasing dts" warnings), which would otherwise bury the actual cause.
 */
function extractError(stderr: string, code: number | null): string {
  const lines = stderr
    .trim()
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  const NOISE = /non monotonically increasing dts|2pass stats say|Last message repeated|deprecated|creation_time|handler_name|vendor_id|encoder\s*:|Stream mapping|Press ctrl|Duration:|start:|bitrate:|Input #|Output #|Metadata:|Stream #|video:|audio:|subtitle:|^\s*$/i
  const ERRORY = /error|invalid|no such file|not found|unable|failed|unsupported|cannot|denied|permission|unknown encoder|height not divisible|conversion failed/i

  const meaningful = lines.filter((l) => !NOISE.test(l))
  const errors = meaningful.filter((l) => ERRORY.test(l))
  const raw = errors.length ? errors.slice(-2).join(' | ') : meaningful.length ? meaningful.slice(-1)[0] : ''

  // Map common FFmpeg errors to plain-English messages
  if (/no such file|not found/i.test(raw)) return 'Source file not found — it may have been moved or deleted'
  if (/permission denied/i.test(raw)) return 'Permission denied — Frostbyte cannot read the source or write the output'
  if (/invalid data|moov atom|corrupt/i.test(raw)) return 'Source file appears corrupt or is not a valid video'
  if (/out of memory/i.test(raw)) return 'Not enough memory to encode — try a lighter preset'
  if (/unknown encoder/i.test(raw)) return 'Encoder not available on this machine'
  if (/conversion failed/i.test(raw)) return 'Encoding failed — source format may be unsupported'
  if (raw) return raw
  return code === null ? 'Encoding was interrupted' : `Encoding failed (exit ${code})`
}

export function runJob(
  item: QueueItem,
  caps: EncoderCapabilities,
  onProgress: (e: ProgressEvent) => void,
  buildExtra: { provenance?: string; lowPriority?: boolean } = {}
): RunningJob {
  let current: ChildProcess | null = null
  let cancelled = false
  const start = Date.now()
  const dur = effectiveDuration(item.settings, item.info)

  const cancel = (): void => {
    cancelled = true
    if (current && current.pid) {
      try {
        current.kill('SIGKILL')
        execFile('taskkill', ['/pid', String(current.pid), '/T', '/F'], () => {})
      } catch {
        /* ignore */
      }
    }
  }

  const suspend = (): void => { if (current?.pid) suspendProcess(current.pid) }
  const resume = (): void => { if (current?.pid) resumeProcess(current.pid) }

  const promise = (async (): Promise<JobResult> => {
    const s = item.settings
    const useTwoPass =
      s.twoPass &&
      s.videoMode !== 'none' &&
      (s.rateControl === 'bitrate' || s.rateControl === 'targetSize')

    // Target-size → compute bitrate.
    let bitrateOverride: number | undefined
    if (s.rateControl === 'targetSize') {
      const audioKbps = s.audioMode === 'none' ? 0 : s.audioMode === 'copy' ? 128 : s.audioBitrateKbps
      bitrateOverride = bitrateForTargetSize(s.targetSizeMB, dur, audioKbps)
    }

    const runPass = async (pass?: 1 | 2): Promise<void> => {
      if (cancelled) throw new Error('Cancelled')
      let args: string[]
      if (item.rawArgsOverride && item.rawArgsOverride.trim()) {
        args = tokenize(item.rawArgsOverride.trim())
      } else {
        const passlog = useTwoPass ? join(tmpdir(), `frostbyte-${item.id}`) : undefined
        args = buildFFmpegArgs(s, item.info, item.outputPath, caps, {
          pass,
          passlog,
          videoBitrateKbpsOverride: bitrateOverride,
          provenance: buildExtra.provenance
        })
      }
      const { child, done } = spawnFfmpeg(args, dur, item.id, pass, onProgress, buildExtra.lowPriority)
      current = child
      await done
    }

    if (useTwoPass && !item.rawArgsOverride) {
      await runPass(1)
      await runPass(2)
    } else {
      await runPass(undefined)
    }

    if (cancelled) throw new Error('Cancelled')

    const outputSizeBytes = existsSync(item.outputPath) ? statSync(item.outputPath).size : 0
    if (outputSizeBytes === 0) throw new Error('Output file was not created')

    const inputSizeBytes = item.info.sizeBytes
    const savedPercent =
      inputSizeBytes > 0
        ? Math.round(((inputSizeBytes - outputSizeBytes) / inputSizeBytes) * 1000) / 10
        : 0

    return {
      outputPath: item.outputPath,
      outputSizeBytes,
      inputSizeBytes,
      savedPercent,
      elapsedSec: Math.round((Date.now() - start) / 1000)
    }
  })()

  // Cleanup partial output on cancel/error.
  promise.catch(() => {
    if (cancelled && existsSync(item.outputPath)) {
      try {
        unlinkSync(item.outputPath)
      } catch {
        /* ignore */
      }
    }
  })

  return { promise, cancel, suspend, resume }
}
