// Watch Folders feature — pure types shared by main + renderer (no runtime imports).
import { CompressionSettings, RESOLUTION_HEIGHT } from './settings'

/** What to do with files when a folder is first added / as new files arrive. */
export type WatchScope = 'existingAndFuture' | 'existingOnly' | 'futureOnly'

/** Replace the original (safe-delete it) or keep both original + compressed. */
export type WatchMode = 'replace' | 'keep'

/** How the original is disposed of in replace mode. */
export type SafeDelete = 'recycle' | 'hold' // hold = move to .frostbyte_originals for N days

/** When queued items are allowed to process. */
export type TriggerMode = 'realtime' | 'scheduled' | 'idle'

export interface WatchSchedule {
  trigger: TriggerMode
  /** "HH:MM" 24h — only used when trigger === 'scheduled'. */
  quietStart?: string
  quietEnd?: string
  /** Minutes of system idle required before processing — only when trigger === 'idle'. */
  idleMinutes?: number
  /** When true (idle mode), only process while on AC power. */
  requireAcPower?: boolean
}

export interface WatchFolder {
  id: string
  path: string
  enabled: boolean
  scope: WatchScope
  mode: WatchMode
  safeDelete: SafeDelete
  holdDays: number
  /** Preset id from SIMPLE_PRESETS, or null when using custom advanced settings. */
  presetId: string | null
  /** Resolved compression profile applied to every file in this folder. */
  settings: CompressionSettings
  schedule: WatchSchedule
  /** Skip files whose predicted savings fall below this percent (avoids pointless re-encodes). */
  minSavingsPercent: number
}

export type WatchFileStatus =
  | 'baseline' // pre-existing, deliberately ignored (futureOnly scope)
  | 'queued'
  | 'processing'
  | 'done'
  | 'skipped' // intentionally not processed (already efficient / already ours)
  | 'error'

export interface WatchFileRecord {
  fingerprint: string // primary key — size + sample hashes + duration
  folderId: string
  originalPath: string
  name: string
  status: WatchFileStatus
  outputPath: string | null
  outputFingerprint: string | null
  origSizeBytes: number
  outSizeBytes: number | null
  savedPercent: number | null
  reason: string | null
  updatedAt: number
}

/** Per-folder rollup shown in the UI. */
export interface WatchFolderStats {
  queued: number
  processing: number
  done: number
  skipped: number
  error: number
  totalSavedBytes: number
}

export const DEFAULT_WATCH_SCHEDULE: WatchSchedule = {
  trigger: 'idle',
  quietStart: '01:00',
  quietEnd: '07:00',
  idleMinutes: 5,
  requireAcPower: true
}

/** Defaults for a brand-new watched folder (settings filled in by caller from a preset). */
export const DEFAULT_WATCH_FOLDER: Omit<WatchFolder, 'id' | 'path' | 'settings'> = {
  enabled: true,
  scope: 'existingAndFuture',
  mode: 'replace',
  safeDelete: 'recycle',
  holdDays: 14,
  presetId: 'balanced',
  schedule: DEFAULT_WATCH_SCHEDULE,
  minSavingsPercent: 5
}

/** File extensions that mean "still being written" — never queue these. */
export const INCOMPLETE_EXTENSIONS = [
  '.part',
  '.crdownload',
  '.tmp',
  '.temp',
  '.download',
  '.!ut', // uTorrent
  '.partial'
]

/** Where held originals live inside a watched folder (replace + hold mode). */
export const HOLD_DIRNAME = '.frostbyte_originals'

/** Minimal probe shape needed for the savings heuristic (subset of MediaInfo). */
export interface SavingsInput {
  sizeBytes: number
  durationSec: number
  width: number
  height: number
  vcodec: string
  fps?: number
}

/**
 * Predicts roughly how much we'd save by compressing `info` with `settings`,
 * as a percent of the original size. Heuristic only — used to skip files that
 * are already efficient (avoids pointless GPU time + generational quality loss).
 *
 * Two estimates are computed and the smaller one wins (the output will be at most
 * the quality ceiling, and at most the source re-expressed in the target codec):
 *   A) quality ceiling  — what a balanced-quality encode produces at the target
 *      resolution + codec (~2200 kbps for 1080p H.264, scaled by area + codec).
 *   B) codec translation — source bitrate × (targetCodecFactor / sourceCodecFactor)
 *      × resolution area ratio. Captures codec-upgrade savings (H.264→HEVC always
 *      saves ~40% even when the source bitrate is already low).
 */
export function predictSavingsPercent(settings: CompressionSettings, info: SavingsInput): number {
  if (info.durationSec <= 0 || info.sizeBytes <= 0) return 0

  // Copy / remux modes don't re-encode video — assume negligible savings.
  if (settings.videoMode === 'none' || settings.videoCodec === 'copy') return 0

  const sourceKbps = (info.sizeBytes * 8) / 1024 / info.durationSec

  // Target height after (optional) downscale, respecting noUpscale.
  let targetH = info.height
  if (settings.resolution !== 'original' && settings.resolution !== 'custom') {
    const presetH = RESOLUTION_HEIGHT[settings.resolution]
    targetH = settings.noUpscale ? Math.min(presetH, info.height) : presetH
  } else if (settings.resolution === 'custom' && settings.customHeight) {
    targetH = settings.noUpscale ? Math.min(settings.customHeight, info.height) : settings.customHeight
  }

  // Codec efficiency factors (lower = more efficient at same perceptual quality).
  const codecFactor: Record<string, number> = {
    h264: 1, hevc: 0.6, h265: 0.6, av1: 0.5, vp9: 0.65, copy: 1
  }
  const targetFactor = codecFactor[settings.videoCodec] ?? 1
  const sourceFactor = codecFactor[info.vcodec?.toLowerCase() ?? ''] ?? 1

  // Screen recording penalty: low-FPS sources (< 15fps) are typically captured by
  // consumer tools (Bandicam, OBS, etc.) whose encoders are far less efficient than
  // x264/NVENC. Real-world tests show ~25-35% savings even for same-codec re-encodes.
  const isScreenRecording = (info.fps ?? 30) < 15

  // Same-codec penalty: consumer encoders (Bandicam, OBS default settings, etc.) produce
  // h264/hevc that is 15-25% larger than what x264/NVENC would at the same perceptual
  // quality — even at bitrates below the quality ceiling. Without this, long Bandicam
  // files (40+ min, bitrate < 2200 kbps) get predicted as 0% savings and are skipped.
  // Frostbyte-compressed outputs are already fingerprinted as 'done' in the ledger and
  // won't be re-queued, so this penalty only affects external consumer-encoded files.
  const isSameCodecFamily = sourceFactor === targetFactor
  const sourceEfficiency = isScreenRecording ? 0.75 : isSameCodecFamily ? 0.82 : 1.0

  // Resolution area ratio — downscaling reduces bitrate roughly proportional to area.
  const resFactor = (targetH / info.height) ** 2

  // (A) Quality ceiling: what a balanced encode produces at target resolution + codec.
  const width16x9 = Math.round((targetH * 16) / 9)
  const megapixels = (width16x9 * targetH) / 1_000_000
  const qualityCeilingKbps = 2200 * (megapixels / 2.07) * targetFactor

  // (B) Codec+resolution translation: source bitrate adjusted for encoder efficiency gap.
  const translatedKbps = sourceKbps * sourceEfficiency * (targetFactor / sourceFactor) * resFactor

  // Output lands near the smaller of the two.
  const estimatedOutputKbps = Math.min(qualityCeilingKbps, translatedKbps)

  if (estimatedOutputKbps >= sourceKbps) return 0
  const saved = (1 - estimatedOutputKbps / sourceKbps) * 100
  return Math.max(0, Math.min(95, Math.round(saved)))
}
