import { describe, it, expect } from 'vitest'
import { predictSavingsPercent, SavingsInput } from '../shared/watch'
import { DEFAULT_SETTINGS, CompressionSettings } from '../shared/settings'

function s(over: Partial<CompressionSettings> = {}): CompressionSettings {
  return { ...DEFAULT_SETTINGS, ...over }
}

// A high-bitrate 1080p source: ~22 Mbps. Lots of headroom to compress.
const fatSource: SavingsInput = {
  sizeBytes: 500_000_000, // 500MB
  durationSec: 180, // 3 min  -> ~22 Mbps
  width: 1920,
  height: 1080,
  vcodec: 'h264'
}

// An already-tiny 1080p source: ~1.3 Mbps. Little to gain re-encoding same codec.
const leanSource: SavingsInput = {
  sizeBytes: 30_000_000, // 30MB
  durationSec: 180, // 3 min -> ~1.3 Mbps
  width: 1920,
  height: 1080,
  vcodec: 'h264'
}

// Long Bandicam recording: ~500MB over ~50 min -> ~1.3 Mbps H.264.
// Previously wrongly skipped when targeting HEVC because bitrate < HEVC quality ceiling.
const bandicamSource: SavingsInput = {
  sizeBytes: 500_000_000,
  durationSec: 3000, // 50 min
  width: 1920,
  height: 1080,
  vcodec: 'h264'
}

describe('predictSavingsPercent (gotcha #3 — skip already-efficient files)', () => {
  it('predicts large savings for a high-bitrate source', () => {
    const pct = predictSavingsPercent(s({ videoCodec: 'h264', resolution: 'original' }), fatSource)
    expect(pct).toBeGreaterThan(50)
  })

  it('predicts ~no savings for an already-lean source', () => {
    const pct = predictSavingsPercent(s({ videoCodec: 'h264', resolution: 'original' }), leanSource)
    expect(pct).toBeLessThan(15)
  })

  it('predicts more savings when downscaling to a smaller resolution', () => {
    const orig = predictSavingsPercent(s({ resolution: 'original' }), fatSource)
    const down = predictSavingsPercent(s({ resolution: '720p' }), fatSource)
    expect(down).toBeGreaterThan(orig)
  })

  it('predicts more savings with a more efficient codec', () => {
    const h264 = predictSavingsPercent(s({ videoCodec: 'h264' }), fatSource)
    const hevc = predictSavingsPercent(s({ videoCodec: 'hevc' }), fatSource)
    expect(hevc).toBeGreaterThan(h264)
  })

  it('predicts codec-upgrade savings even when source bitrate is already low (H.264→HEVC)', () => {
    // Previously returned 0 — source kbps < HEVC quality ceiling, so it was skipped.
    // With the codec-translation fix it should correctly predict ~40% savings.
    const pct = predictSavingsPercent(s({ videoCodec: 'hevc', resolution: 'original' }), bandicamSource)
    expect(pct).toBeGreaterThan(30)
  })

  it('returns 0 for copy / remux (no re-encode)', () => {
    expect(predictSavingsPercent(s({ videoCodec: 'copy' }), fatSource)).toBe(0)
    expect(predictSavingsPercent(s({ videoMode: 'none' }), fatSource)).toBe(0)
  })

  it('does not over-promise on a zero-duration / empty file', () => {
    expect(predictSavingsPercent(s(), { ...fatSource, durationSec: 0 })).toBe(0)
  })
})
