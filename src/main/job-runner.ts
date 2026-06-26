import { spawn, ChildProcess, execFile } from 'child_process'
import { tmpdir } from 'os'
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
}

function spawnFfmpeg(
  args: string[],
  durationSec: number,
  id: string,
  pass: 1 | 2 | undefined,
  onProgress: (e: ProgressEvent) => void
): { child: ChildProcess; done: Promise<void> } {
  const full = ['-progress', 'pipe:1', '-nostats', ...args]
  const child = spawn(ffmpegPath(), full, { windowsHide: true })
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
  if (!lines.length) return `ffmpeg exited ${code}`

  const NOISE = /non monotonically increasing dts|2pass stats say|Last message repeated|deprecated/i
  const ERRORY = /error|invalid|no such file|not found|unable|failed|unsupported|cannot|denied|permission|unknown encoder|height not divisible|conversion failed/i

  const meaningful = lines.filter((l) => !NOISE.test(l))
  const errors = meaningful.filter((l) => ERRORY.test(l))
  if (errors.length) return errors.slice(-2).join(' ')
  if (meaningful.length) return meaningful.slice(-2).join(' ')
  return lines.slice(-1)[0] || `ffmpeg exited ${code}`
}

export function runJob(
  item: QueueItem,
  caps: EncoderCapabilities,
  onProgress: (e: ProgressEvent) => void,
  buildExtra: { provenance?: string } = {}
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
      const { child, done } = spawnFfmpeg(args, dur, item.id, pass, onProgress)
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

  return { promise, cancel }
}
