import { execFile } from 'child_process'
import { promisify } from 'util'
import { basename } from 'path'
import { statSync } from 'fs'
import { ffprobePath } from './ffmpeg-path'
import { MediaInfo } from '@shared/ipc-contract'

const execFileAsync = promisify(execFile)

function parseFps(rate: string | undefined): number {
  if (!rate) return 0
  const [n, d] = rate.split('/').map(Number)
  if (!d) return n || 0
  return Math.round((n / d) * 100) / 100
}

export async function probe(path: string): Promise<MediaInfo> {
  const { stdout } = await execFileAsync(
    ffprobePath(),
    [
      '-v',
      'error',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      path
    ],
    { maxBuffer: 1024 * 1024 * 16 }
  )
  const data = JSON.parse(stdout)
  const streams: any[] = data.streams ?? []
  const v = streams.find((s) => s.codec_type === 'video')
  const a = streams.find((s) => s.codec_type === 'audio')
  const subs = streams.filter((s) => s.codec_type === 'subtitle')

  const durationSec =
    parseFloat(data.format?.duration) || parseFloat(v?.duration) || 0
  const pixFmt: string = v?.pix_fmt ?? 'yuv420p'
  const bitDepth: 8 | 10 = pixFmt.includes('10') ? 10 : 8

  let sizeBytes = parseInt(data.format?.size, 10)
  if (!sizeBytes) {
    try {
      sizeBytes = statSync(path).size
    } catch {
      sizeBytes = 0
    }
  }

  return {
    path,
    name: basename(path),
    sizeBytes,
    durationSec,
    width: v?.width ?? 0,
    height: v?.height ?? 0,
    fps: parseFps(v?.avg_frame_rate ?? v?.r_frame_rate),
    vcodec: v?.codec_name ?? 'unknown',
    acodec: a?.codec_name ?? null,
    pixFmt,
    bitDepth,
    hasAudio: !!a,
    hasSubtitles: subs.length > 0
  }
}

export async function ffmpegVersion(ffmpegBin: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync(ffmpegBin, ['-version'], { maxBuffer: 1024 * 1024 })
    const m = stdout.match(/ffmpeg version (\S+)/)
    return m ? m[1] : 'unknown'
  } catch {
    return 'unavailable'
  }
}
