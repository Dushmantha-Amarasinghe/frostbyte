import { describe, it, expect } from 'vitest'
import { buildFFmpegArgs, effectiveDuration, tokenize } from '../shared/command-builder'
import { DEFAULT_SETTINGS, CompressionSettings } from '../shared/settings'
import { EMPTY_CAPS, EncoderCapabilities } from '../shared/encoders'
import { bitrateForTargetSize } from '../shared/target-size'
import { compareSemver, isNewer } from '../shared/version'
import { MediaInfo } from '../shared/ipc-contract'

const info: MediaInfo = {
  path: 'C:/videos/clip.mp4',
  name: 'clip.mp4',
  sizeBytes: 100_000_000,
  durationSec: 180,
  width: 1920,
  height: 1080,
  fps: 30,
  vcodec: 'h264',
  acodec: 'aac',
  pixFmt: 'yuv420p',
  bitDepth: 8,
  hasAudio: true,
  hasSubtitles: false
}

const out = 'C:/out/clip_compressed.mp4'

function s(over: Partial<CompressionSettings> = {}): CompressionSettings {
  return { ...DEFAULT_SETTINGS, ...over }
}

const NVENC_CAPS: EncoderCapabilities = {
  ...EMPTY_CAPS,
  nvenc: { h264: true, hevc: true, av1: false },
  vendorGuess: 'nvidia'
}

describe('command-builder: video codec & rate control', () => {
  it('software x264 CRF', () => {
    const args = buildFFmpegArgs(s({ preferHardware: false, crf: 23 }), info, out, EMPTY_CAPS)
    expect(args).toContain('-c:v')
    expect(args).toContain('libx264')
    expect(args.join(' ')).toContain('-crf 23')
    expect(args[args.length - 1]).toBe(out)
  })

  it('prefers NVENC when available and preferHardware', () => {
    const args = buildFFmpegArgs(s({ videoCodec: 'h264', preferHardware: true }), info, out, NVENC_CAPS)
    expect(args.join(' ')).toContain('h264_nvenc')
    expect(args.join(' ')).toContain('-cq')
  })

  it('falls back to libx265 when no hw hevc', () => {
    const args = buildFFmpegArgs(s({ videoCodec: 'hevc', preferHardware: true }), info, out, EMPTY_CAPS)
    expect(args.join(' ')).toContain('libx265')
    expect(args.join(' ')).toContain('-tag:v hvc1') // hevc in mp4
  })

  it('stream copy', () => {
    const args = buildFFmpegArgs(s({ videoCodec: 'copy', audioMode: 'copy' }), info, out, EMPTY_CAPS)
    expect(args.join(' ')).toContain('-c:v copy')
    expect(args.join(' ')).toContain('-c:a copy')
  })
})

describe('command-builder: scaling never upscales', () => {
  it('uses min() guard for 720p with noUpscale', () => {
    const args = buildFFmpegArgs(s({ resolution: '720p', noUpscale: true }), info, out, EMPTY_CAPS)
    expect(args.join(' ')).toContain("scale=-2:'min(720,ih)'")
  })
  it('plain scale when noUpscale off', () => {
    const args = buildFFmpegArgs(s({ resolution: '1080p', noUpscale: false }), info, out, EMPTY_CAPS)
    expect(args.join(' ')).toContain('scale=-2:1080')
  })
})

describe('command-builder: bitrate ceiling & two-pass', () => {
  it('adds maxrate/bufsize in bitrate mode', () => {
    const args = buildFFmpegArgs(
      s({ rateControl: 'bitrate', videoBitrateKbps: 2000 }),
      info,
      out,
      EMPTY_CAPS
    )
    const j = args.join(' ')
    expect(j).toContain('-b:v 2000k')
    expect(j).toContain('-maxrate 3000k')
    expect(j).toContain('-bufsize 4000k')
  })

  it('pass 1 writes to null and drops audio', () => {
    const args = buildFFmpegArgs(
      s({ rateControl: 'targetSize', twoPass: true }),
      info,
      out,
      EMPTY_CAPS,
      { pass: 1, passlog: 'C:/tmp/pass' }
    )
    const j = args.join(' ')
    expect(j).toContain('-pass 1')
    expect(j).toContain('-an')
    expect(j).toContain('-f null')
    expect(args).not.toContain(out)
  })
})

describe('command-builder: trim', () => {
  it('seeks before input and limits duration', () => {
    const args = buildFFmpegArgs(s({ trimStartSec: 10, trimEndSec: 25 }), info, out, EMPTY_CAPS)
    const iIdx = args.indexOf('-i')
    const ssIdx = args.indexOf('-ss')
    expect(ssIdx).toBeGreaterThanOrEqual(0)
    expect(ssIdx).toBeLessThan(iIdx) // -ss before -i (fast seek)
    expect(args.join(' ')).toContain('-t 15')
  })
  it('effectiveDuration accounts for trim', () => {
    expect(effectiveDuration(s({ trimStartSec: 10, trimEndSec: 40 }), info)).toBe(30)
    expect(effectiveDuration(s(), info)).toBe(180)
  })
})

describe('command-builder: filters & audio', () => {  it('builds rotate + denoise + faststart', () => {
    const args = buildFFmpegArgs(
      s({ rotate: 90, denoise: 'medium', audioMode: 'none' }),
      info,
      out,
      EMPTY_CAPS
    )
    const j = args.join(' ')
    expect(j).toContain('transpose=1')
    expect(j).toContain('hqdn3d=4:4:9:9')
    expect(j).toContain('-an')
    expect(j).toContain('+faststart')
  })

  it('extra raw args are tokenized and appended', () => {
    const args = buildFFmpegArgs(s({ extraArgs: '-metadata title="My Clip"' }), info, out, EMPTY_CAPS)
    expect(args).toContain('-metadata')
    expect(args).toContain('title=My Clip')
  })
})

describe('command-builder: audio-only export', () => {
  it('emits -vn, no video codec, keeps audio', () => {
    const args = buildFFmpegArgs(
      s({ videoMode: 'none', audioMode: 'encode', audioCodec: 'mp3', audioBitrateKbps: 192 }),
      info,
      'C:/out/clip.mp3',
      EMPTY_CAPS
    )
    const j = args.join(' ')
    expect(j).toContain('-vn')
    expect(j).not.toContain('-c:v')
    expect(j).toContain('libmp3lame')
    expect(j).toContain('-b:a 192k')
  })

  it('forces an audio stream even if audioMode was none', () => {
    const args = buildFFmpegArgs(
      s({ videoMode: 'none', audioMode: 'none', audioCodec: 'aac' }),
      info,
      'C:/out/clip.m4a',
      EMPTY_CAPS
    )
    const j = args.join(' ')
    expect(j).toContain('-vn')
    expect(j).not.toContain('-an')
    expect(j).toContain('aac')
  })

  it('skips two-pass and faststart in audio-only mode', () => {
    const args = buildFFmpegArgs(
      s({ videoMode: 'none', faststart: true, audioCodec: 'aac' }),
      info,
      'C:/out/clip.m4a',
      EMPTY_CAPS,
      { pass: 1 }
    )
    const j = args.join(' ')
    expect(j).not.toContain('-pass')
    expect(j).not.toContain('+faststart')
  })
})

describe('tokenize', () => {  it('respects quotes', () => {
    expect(tokenize('-x 1 -y "a b" -z \'c d\'')).toEqual(['-x', '1', '-y', 'a b', '-z', 'c d'])
  })
})

describe('target-size', () => {
  it('computes a positive bitrate under budget', () => {
    const br = bitrateForTargetSize(10, 180, 96)
    expect(br).toBeGreaterThan(50)
    // ~ (10*8*1024*0.97 - 96*180)/180
    expect(br).toBeLessThan(500)
  })
})

describe('version compare', () => {
  it('orders correctly', () => {
    expect(compareSemver('1.2.0', '1.1.9')).toBeGreaterThan(0)
    expect(compareSemver('v1.0.0', '1.0.0')).toBe(0)
    expect(isNewer('2.0.0', '1.9.9')).toBe(true)
    expect(isNewer('1.0.0', '1.0.1')).toBe(false)
  })
})
