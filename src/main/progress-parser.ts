import { ProgressEvent } from '@shared/ipc-contract'

/**
 * Parses ffmpeg's `-progress pipe:1` key=value stream into ProgressEvent.
 * Total (trimmed) duration is supplied up front so percent/ETA are accurate.
 */
export class ProgressParser {
  private buf = ''
  private acc: Record<string, string> = {}

  constructor(
    private id: string,
    private durationSec: number,
    private onProgress: (e: ProgressEvent) => void,
    private pass?: 1 | 2
  ) {}

  feed(chunk: Buffer | string): void {
    this.buf += chunk.toString()
    let nl: number
    while ((nl = this.buf.indexOf('\n')) >= 0) {
      const line = this.buf.slice(0, nl).trim()
      this.buf = this.buf.slice(nl + 1)
      if (!line) continue
      const eq = line.indexOf('=')
      if (eq < 0) continue
      const key = line.slice(0, eq)
      const val = line.slice(eq + 1)
      this.acc[key] = val
      if (key === 'progress') this.emit(val === 'end')
    }
  }

  private emit(end: boolean): void {
    const a = this.acc
    // out_time_us (newer) or out_time_ms (older, also microseconds despite name).
    const us = parseInt(a.out_time_us ?? a.out_time_ms ?? '0', 10)
    const outTimeSec = us > 0 ? us / 1_000_000 : 0
    const fps = parseFloat(a.fps ?? '0') || 0
    const speed = parseFloat((a.speed ?? '0').replace('x', '')) || 0
    const bitrateKbps = Math.round((parseFloat((a.bitrate ?? '0').replace('kbits/s', '')) || 0))
    const frame = parseInt(a.frame ?? '0', 10) || 0
    const percent = end
      ? 100
      : this.durationSec > 0
        ? Math.min(99, Math.round((outTimeSec / this.durationSec) * 1000) / 10)
        : 0
    const etaSec =
      !end && speed > 0 && this.durationSec > 0
        ? Math.max(0, Math.round((this.durationSec - outTimeSec) / speed))
        : end
          ? 0
          : null

    this.onProgress({
      id: this.id,
      percent,
      fps,
      speed,
      outTimeSec,
      bitrateKbps,
      etaSec,
      frame,
      pass: this.pass
    })
  }
}
