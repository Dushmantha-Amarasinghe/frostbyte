import { VideoCodec } from './settings'

export type HwFamily = 'nvenc' | 'qsv' | 'amf'

export interface EncoderCapabilities {
  nvenc: { h264: boolean; hevc: boolean; av1: boolean }
  qsv: { h264: boolean; hevc: boolean; av1: boolean }
  amf: { h264: boolean; hevc: boolean; av1: boolean }
  software: { x264: boolean; x265: boolean; vp9: boolean; av1: boolean }
  vendorGuess: 'nvidia' | 'intel' | 'amd' | 'unknown'
}

export const EMPTY_CAPS: EncoderCapabilities = {
  nvenc: { h264: false, hevc: false, av1: false },
  qsv: { h264: false, hevc: false, av1: false },
  amf: { h264: false, hevc: false, av1: false },
  software: { x264: true, x265: true, vp9: true, av1: true },
  vendorGuess: 'unknown'
}

export interface ResolvedEncoder {
  /** Concrete ffmpeg encoder name, e.g. 'h264_nvenc' or 'libx264'. */
  name: string
  /** Family used to choose the right rate-control flags. */
  family: 'x264' | 'x265' | 'vpx' | 'svtav1' | 'aom' | 'nvenc' | 'qsv' | 'amf' | 'copy'
  hardware: boolean
}

const HW_ORDER: HwFamily[] = ['nvenc', 'qsv', 'amf']

/**
 * Resolves the logical codec + hardware preference + machine capabilities into a
 * concrete ffmpeg encoder. Hardware encoders are preferred for speed when available.
 */
export function resolveVideoEncoder(
  codec: VideoCodec,
  preferHardware: boolean,
  caps: EncoderCapabilities,
  forceEncoder?: string | null
): ResolvedEncoder {
  if (forceEncoder) {
    return { name: forceEncoder, family: familyOf(forceEncoder), hardware: forceEncoder.includes('_') }
  }
  if (codec === 'copy') return { name: 'copy', family: 'copy', hardware: false }

  if (preferHardware && (codec === 'h264' || codec === 'hevc' || codec === 'av1')) {
    const key = codec === 'h264' ? 'h264' : codec === 'hevc' ? 'hevc' : 'av1'
    for (const fam of HW_ORDER) {
      if (caps[fam][key]) {
        const name =
          fam === 'nvenc'
            ? `${codec === 'hevc' ? 'hevc' : codec}_nvenc`
            : fam === 'qsv'
              ? `${codec === 'hevc' ? 'hevc' : codec}_qsv`
              : `${codec === 'hevc' ? 'hevc' : codec}_amf`
        return { name, family: fam, hardware: true }
      }
    }
  }

  // Software fallback
  switch (codec) {
    case 'h264':
      return { name: 'libx264', family: 'x264', hardware: false }
    case 'hevc':
      return { name: 'libx265', family: 'x265', hardware: false }
    case 'vp9':
      return { name: 'libvpx-vp9', family: 'vpx', hardware: false }
    case 'av1':
      return { name: 'libsvtav1', family: 'svtav1', hardware: false }
    default:
      return { name: 'libx264', family: 'x264', hardware: false }
  }
}

function familyOf(encoder: string): ResolvedEncoder['family'] {
  if (encoder === 'copy') return 'copy'
  if (encoder.includes('nvenc')) return 'nvenc'
  if (encoder.includes('qsv')) return 'qsv'
  if (encoder.includes('amf')) return 'amf'
  if (encoder.includes('x264')) return 'x264'
  if (encoder.includes('x265')) return 'x265'
  if (encoder.includes('vpx')) return 'vpx'
  if (encoder.includes('svtav1')) return 'svtav1'
  if (encoder.includes('aom')) return 'aom'
  return 'x264'
}

/** Maps the generic x264-style preset to NVENC p1..p7 / SVT-AV1 numeric. */
export function mapPreset(family: ResolvedEncoder['family'], preset: string): string {
  if (family === 'nvenc') {
    const m: Record<string, string> = {
      ultrafast: 'p1',
      superfast: 'p2',
      veryfast: 'p3',
      faster: 'p4',
      fast: 'p4',
      medium: 'p5',
      slow: 'p6',
      slower: 'p7',
      veryslow: 'p7'
    }
    return m[preset] ?? 'p5'
  }
  return preset
}
