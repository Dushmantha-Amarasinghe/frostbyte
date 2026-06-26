import { describe, it, expect } from 'vitest'
import { buildFFmpegArgs } from '../shared/command-builder'
import { DEFAULT_SETTINGS, CompressionSettings } from '../shared/settings'
import { EMPTY_CAPS } from '../shared/encoders'
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
const out = 'C:/out/clip.mp4'

function s(over: Partial<CompressionSettings> = {}): CompressionSettings {
  return { ...DEFAULT_SETTINGS, ...over }
}

describe('provenance metadata injection', () => {
  const value = 'v1;preset=balanced;orig=123;ts=456'

  it('stamps the frostbyte tag into the output when provenance is provided', () => {
    const args = buildFFmpegArgs(s(), info, out, EMPTY_CAPS, { provenance: value })
    const i = args.indexOf('-metadata')
    expect(i).toBeGreaterThan(-1)
    expect(args[i + 1]).toBe(`frostbyte=${value}`)
    // tag must come before the output path
    expect(args.indexOf(`frostbyte=${value}`)).toBeLessThan(args.indexOf(out))
  })

  it('omits the tag when no provenance is provided (manual Compress-tab jobs)', () => {
    const args = buildFFmpegArgs(s(), info, out, EMPTY_CAPS)
    expect(args.some((a) => a.startsWith('frostbyte='))).toBe(false)
  })

  it('never stamps the tag on the pass-1 null output', () => {
    const args = buildFFmpegArgs(s({ twoPass: true, rateControl: 'bitrate' }), info, out, EMPTY_CAPS, {
      pass: 1,
      provenance: value
    })
    expect(args.some((a) => a.startsWith('frostbyte='))).toBe(false)
  })
})
