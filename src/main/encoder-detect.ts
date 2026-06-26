import { execFile } from 'child_process'
import { ffmpegPath } from './ffmpeg-path'
import { EncoderCapabilities, EMPTY_CAPS } from '@shared/encoders'

let cache: EncoderCapabilities | null = null

function listEncoders(): Promise<string> {
  return new Promise((resolve) => {
    execFile(ffmpegPath(), ['-hide_banner', '-encoders'], { maxBuffer: 1024 * 1024 * 8 }, (_err, stdout) => {
      resolve(stdout || '')
    })
  })
}

/** Real capability test: encode a 3-frame synthetic clip; exit 0 = encoder usable on this machine. */
function testEncoder(name: string): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(
      ffmpegPath(),
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-f',
        'lavfi',
        '-i',
        'color=c=black:s=256x256:d=0.1',
        '-frames:v',
        '3',
        '-c:v',
        name,
        '-f',
        'null',
        '-'
      ],
      { timeout: 15000 },
      (err) => resolve(!err)
    )
  })
}

export async function detectEncoders(force = false): Promise<EncoderCapabilities> {
  if (cache && !force) return cache

  const list = await listEncoders()
  const present = (name: string): boolean => list.includes(name)

  // Only capability-test encoders that exist in the build.
  const candidates = [
    'h264_nvenc',
    'hevc_nvenc',
    'av1_nvenc',
    'h264_qsv',
    'hevc_qsv',
    'av1_qsv',
    'h264_amf',
    'hevc_amf',
    'av1_amf'
  ].filter(present)

  const results = await Promise.all(
    candidates.map(async (name) => [name, await testEncoder(name)] as const)
  )
  const ok = new Map(results)
  const works = (name: string): boolean => ok.get(name) ?? false

  const caps: EncoderCapabilities = {
    nvenc: { h264: works('h264_nvenc'), hevc: works('hevc_nvenc'), av1: works('av1_nvenc') },
    qsv: { h264: works('h264_qsv'), hevc: works('hevc_qsv'), av1: works('av1_qsv') },
    amf: { h264: works('h264_amf'), hevc: works('hevc_amf'), av1: works('av1_amf') },
    software: {
      x264: present('libx264'),
      x265: present('libx265'),
      vp9: present('libvpx-vp9'),
      av1: present('libsvtav1') || present('libaom-av1')
    },
    vendorGuess: 'unknown'
  }

  const anyHw = (f: { h264: boolean; hevc: boolean; av1: boolean }): boolean =>
    f.h264 || f.hevc || f.av1
  if (anyHw(caps.nvenc)) caps.vendorGuess = 'nvidia'
  else if (anyHw(caps.qsv)) caps.vendorGuess = 'intel'
  else if (anyHw(caps.amf)) caps.vendorGuess = 'amd'

  cache = caps
  return caps
}

export function cachedCaps(): EncoderCapabilities {
  return cache ?? EMPTY_CAPS
}
