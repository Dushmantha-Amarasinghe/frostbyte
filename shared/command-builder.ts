import { CompressionSettings, RESOLUTION_HEIGHT } from './settings'
import { EncoderCapabilities, resolveVideoEncoder, mapPreset, ResolvedEncoder } from './encoders'
import { MediaInfo } from './ipc-contract'

export interface BuildOpts {
  pass?: 1 | 2
  passlog?: string
  /** Overrides video bitrate (used by target-size mode). */
  videoBitrateKbpsOverride?: number
  /** Provenance metadata value stamped into the output (Watch folders). */
  provenance?: string
}

/** Effective output duration accounting for trim. */
export function effectiveDuration(s: CompressionSettings, info: MediaInfo): number {
  const start = s.trimStartSec ?? 0
  const end = s.trimEndSec ?? info.durationSec
  return Math.max(0, end - start)
}

function buildFilterChain(s: CompressionSettings): string[] {
  const filters: string[] = []

  if (s.deinterlace) filters.push('yadif')

  if (s.crop) filters.push(`crop=${s.crop.w}:${s.crop.h}:${s.crop.x}:${s.crop.y}`)

  // Scaling (height-based, keep aspect, never upscale when noUpscale).
  if (s.resolution === 'custom' && (s.customWidth || s.customHeight)) {
    const w = s.customWidth ?? -2
    const h = s.customHeight ?? -2
    filters.push(`scale=${w}:${h}:flags=${s.scaleFlags ?? 'bicubic'}`)
  } else if (s.resolution !== 'original') {
    const h = RESOLUTION_HEIGHT[s.resolution]
    const expr = s.noUpscale ? `-2:'min(${h},ih)'` : `-2:${h}`
    filters.push(`scale=${expr}:flags=${s.scaleFlags ?? 'bicubic'}`)
  }

  // Rotation / flips
  if (s.rotate === 90) filters.push('transpose=1')
  else if (s.rotate === 270) filters.push('transpose=2')
  else if (s.rotate === 180) filters.push('transpose=1,transpose=1')
  if (s.flipH) filters.push('hflip')
  if (s.flipV) filters.push('vflip')

  // Denoise
  if (s.denoise === 'light') filters.push('hqdn3d=1.5:1.5:6:6')
  else if (s.denoise === 'medium') filters.push('hqdn3d=4:4:9:9')
  else if (s.denoise === 'strong') filters.push('hqdn3d=8:8:12:12')

  if (s.sharpen) filters.push('unsharp=5:5:0.8:5:5:0.0')

  // Subtitle burn-in (last in chain)
  if (s.subtitleMode === 'burn' && s.subtitlePath) {
    filters.push(`subtitles='${s.subtitlePath.replace(/\\/g, '/').replace(/:/g, '\\:')}'`)
  }

  if (s.fps) filters.push(`fps=${s.fps}`)

  return filters
}

function rateControlArgs(
  enc: ResolvedEncoder,
  s: CompressionSettings,
  opts: BuildOpts
): string[] {
  const args: string[] = []
  const bitrate = opts.videoBitrateKbpsOverride ?? s.videoBitrateKbps
  const useBitrate = s.rateControl === 'bitrate' || s.rateControl === 'targetSize'

  switch (enc.family) {
    case 'x264':
    case 'x265':
      if (useBitrate) args.push('-b:v', `${bitrate}k`)
      else if (s.rateControl === 'cqp') args.push('-qp', `${s.cqp}`)
      else args.push('-crf', `${s.crf}`)
      break
    case 'svtav1':
      if (useBitrate) args.push('-b:v', `${bitrate}k`)
      else args.push('-crf', `${s.crf}`)
      break
    case 'vpx':
      if (useBitrate) args.push('-b:v', `${bitrate}k`)
      else args.push('-crf', `${s.crf}`, '-b:v', '0')
      break
    case 'nvenc':
      if (useBitrate) args.push('-rc', 'vbr', '-b:v', `${bitrate}k`)
      else args.push('-rc', 'vbr', '-cq', `${s.rateControl === 'cqp' ? s.cqp : s.crf}`, '-b:v', '0')
      break
    case 'qsv':
      if (useBitrate) args.push('-b:v', `${bitrate}k`)
      else args.push('-global_quality', `${s.rateControl === 'cqp' ? s.cqp : s.crf}`)
      break
    case 'amf': {
      const q = s.rateControl === 'cqp' ? s.cqp : s.crf
      if (useBitrate) args.push('-rc', 'vbr_latency', '-b:v', `${bitrate}k`)
      else args.push('-rc', 'cqp', '-qp_i', `${q}`, '-qp_p', `${q}`, '-qp_b', `${q}`)
      break
    }
    case 'copy':
    default:
      break
  }

  // Bitrate ceiling (prevents file inflation, mirrors mobile fix).
  if (useBitrate && enc.family !== 'copy') {
    const maxrate = s.maxrateKbps ?? Math.round(bitrate * 1.5)
    const bufsize = s.bufsizeKbps ?? Math.round(bitrate * 2)
    args.push('-maxrate', `${maxrate}k`, '-bufsize', `${bufsize}k`)
  }
  return args
}

function presetTuningArgs(enc: ResolvedEncoder, s: CompressionSettings): string[] {
  const args: string[] = []
  const presetFamilies = ['x264', 'x265', 'nvenc', 'qsv', 'svtav1']
  if (presetFamilies.includes(enc.family)) {
    args.push('-preset', mapPreset(enc.family, s.preset))
  } else if (enc.family === 'amf') {
    args.push('-quality', 'balanced')
  }
  if (s.tune && (enc.family === 'x264' || enc.family === 'x265' || enc.family === 'nvenc')) {
    args.push('-tune', s.tune)
  }
  if (s.profile && enc.family !== 'copy') args.push('-profile:v', s.profile)
  if (s.level && enc.family !== 'copy') args.push('-level', s.level)
  if (s.gopSize && enc.family !== 'copy') args.push('-g', `${s.gopSize}`)
  if (s.keyintMin && (enc.family === 'x264' || enc.family === 'x265')) {
    args.push('-keyint_min', `${s.keyintMin}`)
  }
  if (s.bFrames != null && enc.family !== 'copy') args.push('-bf', `${s.bFrames}`)
  return args
}

function audioArgs(s: CompressionSettings, pass?: 1 | 2): string[] {
  if (pass === 1) return ['-an'] // pass 1 ignores audio
  if (s.audioMode === 'none') return ['-an']
  if (s.audioMode === 'copy') return ['-c:a', 'copy']
  const codecMap: Record<string, string> = {
    aac: 'aac',
    opus: 'libopus',
    mp3: 'libmp3lame',
    flac: 'flac',
    ac3: 'ac3'
  }
  const args = ['-c:a', codecMap[s.audioCodec] ?? 'aac']
  if (s.audioCodec !== 'flac') args.push('-b:a', `${s.audioBitrateKbps}k`)
  if (s.audioChannels) args.push('-ac', `${s.audioChannels}`)
  if (s.audioSampleRate) args.push('-ar', `${s.audioSampleRate}`)
  return args
}

function tokenize(raw: string): string[] {
  // Splits a raw arg string respecting quotes anywhere in a token,
  // so `title="My Clip"` becomes the single token `title=My Clip`.
  const out: string[] = []
  let cur = ''
  let quote: string | null = null
  let started = false
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    if (quote) {
      if (ch === quote) quote = null
      else cur += ch
    } else if (ch === '"' || ch === "'") {
      quote = ch
      started = true
    } else if (ch === ' ' || ch === '\t' || ch === '\n') {
      if (started) {
        out.push(cur)
        cur = ''
        started = false
      }
    } else {
      cur += ch
      started = true
    }
  }
  if (started) out.push(cur)
  return out
}

/**
 * Pure: settings + media info -> ffmpeg argument array.
 * The renderer's CommandPreview and the main job-runner both call this so the
 * shown command is byte-identical to what runs.
 */
export function buildFFmpegArgs(
  s: CompressionSettings,
  info: MediaInfo,
  outputPath: string,
  caps: EncoderCapabilities,
  opts: BuildOpts = {}
): string[] {
  const enc = resolveVideoEncoder(s.videoCodec, s.preferHardware, caps, s.forceEncoder)
  const args: string[] = ['-y', '-hide_banner']

  // Fast trim: -ss before input.
  if (s.trimStartSec && s.trimStartSec > 0) args.push('-ss', `${s.trimStartSec}`)

  args.push('-i', info.path)

  // Trim duration after input.
  if (s.trimEndSec != null) {
    const dur = Math.max(0.1, s.trimEndSec - (s.trimStartSec ?? 0))
    args.push('-t', `${dur}`)
  }

  // Video (or audio-only export with -vn)
  if (s.videoMode === 'none') {
    args.push('-vn')
  } else {
    args.push('-c:v', enc.name)
    if (enc.family !== 'copy') {
      args.push(...rateControlArgs(enc, s, opts))
      args.push(...presetTuningArgs(enc, s))

      const filters = buildFilterChain(s)
      if (filters.length) args.push('-vf', filters.join(','))

      if (s.pixelFormat !== 'auto') args.push('-pix_fmt', s.pixelFormat)
      else if (s.bitDepth === 10) args.push('-pix_fmt', 'yuv420p10le')
    }

    // Container-specific
    if (s.videoCodec === 'hevc' && (s.container === 'mp4' || s.container === 'mov')) {
      args.push('-tag:v', 'hvc1')
    }
  }

  // Two-pass (video only)
  if (opts.pass && s.videoMode !== 'none') {
    args.push('-pass', `${opts.pass}`)
    if (opts.passlog) args.push('-passlogfile', opts.passlog)
  }

  // Audio. In audio-only export, force an audio stream even if mode was none/copy-without-source.
  if (s.videoMode === 'none' && (s.audioMode === 'none')) {
    args.push(...audioArgs({ ...s, audioMode: 'encode' }, undefined))
  } else {
    args.push(...audioArgs(s, opts.pass))
  }

  // Subtitles (copy/embed) — not applicable to audio-only output
  if (s.videoMode !== 'none' && s.subtitleMode === 'copy') {
    args.push('-c:s', s.container === 'mp4' ? 'mov_text' : 'copy')
  }

  if (s.threads != null) args.push('-threads', `${s.threads}`)
  if (s.videoMode !== 'none' && s.faststart && (s.container === 'mp4' || s.container === 'mov')) {
    args.push('-movflags', '+faststart')
  }

  if (s.extraArgs && s.extraArgs.trim()) args.push(...tokenize(s.extraArgs.trim()))

  // Provenance tag (Watch folders) — only on the real output pass.
  if (opts.provenance && opts.pass !== 1) {
    args.push('-metadata', `frostbyte=${opts.provenance}`)
  }

  // Output
  if (opts.pass === 1) {
    args.push('-f', 'null', process.platform === 'win32' ? 'NUL' : '/dev/null')
  } else {
    args.push(outputPath)
  }
  return args
}

/** Pretty single-line command string for the preview UI. */
export function argsToDisplay(args: string[]): string {
  return (
    'ffmpeg ' +
    args.map((a) => (/[\s'"]/.test(a) ? `"${a}"` : a)).join(' ')
  )
}

export { tokenize }
