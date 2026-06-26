// Full FFmpeg setting surface. Pure types + defaults, shared by main and renderer.

export type Container = 'mp4' | 'mkv' | 'mov' | 'webm'
export type VideoCodec = 'h264' | 'hevc' | 'vp9' | 'av1' | 'copy'
export type RateControl = 'crf' | 'cqp' | 'bitrate' | 'targetSize'
export type PixelFormat = 'auto' | 'yuv420p' | 'yuv420p10le' | 'yuv422p' | 'yuv444p'
export type ResolutionPreset =
  | 'original'
  | '480p'
  | '720p'
  | '1080p'
  | '1440p'
  | '2160p'
  | 'custom'
export type AudioMode = 'encode' | 'copy' | 'none'
export type AudioCodec = 'aac' | 'opus' | 'mp3' | 'flac' | 'ac3'
export type VideoMode = 'encode' | 'none'

/** File extension to use when exporting audio only (videoMode === 'none'). */
export const AUDIO_EXT: Record<AudioCodec, string> = {
  aac: 'm4a',
  opus: 'opus',
  mp3: 'mp3',
  flac: 'flac',
  ac3: 'ac3'
}
export type Denoise = 'none' | 'light' | 'medium' | 'strong'
export type SubtitleMode = 'none' | 'copy' | 'burn'

export interface CompressionSettings {
  // Container / output
  container: Container
  faststart: boolean

  // Video codec & hardware
  videoCodec: VideoCodec
  videoMode: VideoMode
  preferHardware: boolean
  forceEncoder?: string | null

  // Rate control
  rateControl: RateControl
  crf: number
  cqp: number
  videoBitrateKbps: number
  twoPass: boolean
  targetSizeMB: number
  maxrateKbps?: number | null
  bufsizeKbps?: number | null

  // Encoder tuning
  preset: string
  tune?: string | null
  profile?: string | null
  level?: string | null
  pixelFormat: PixelFormat
  bitDepth: 8 | 10
  gopSize?: number | null
  keyintMin?: number | null
  bFrames?: number | null

  // Scaling / framerate
  resolution: ResolutionPreset
  customWidth?: number | null
  customHeight?: number | null
  noUpscale: boolean
  scaleFlags?: 'bicubic' | 'lanczos' | 'bilinear'
  fps?: number | null

  // Audio
  audioMode: AudioMode
  audioCodec: AudioCodec
  audioBitrateKbps: number
  audioChannels?: 1 | 2 | 6 | null
  audioSampleRate?: 44100 | 48000 | null

  // Filters
  trimStartSec?: number | null
  trimEndSec?: number | null
  crop?: { w: number; h: number; x: number; y: number } | null
  rotate: 0 | 90 | 180 | 270
  flipH: boolean
  flipV: boolean
  deinterlace: boolean
  denoise: Denoise
  sharpen: boolean

  // Subtitles
  subtitleMode: SubtitleMode
  subtitlePath?: string | null
  subtitleStreamIndex?: number | null

  // Performance / escape hatch
  threads?: number | null
  extraArgs?: string
}

export const RESOLUTION_HEIGHT: Record<Exclude<ResolutionPreset, 'original' | 'custom'>, number> = {
  '480p': 480,
  '720p': 720,
  '1080p': 1080,
  '1440p': 1440,
  '2160p': 2160
}

export const DEFAULT_SETTINGS: CompressionSettings = {
  container: 'mp4',
  faststart: true,

  videoCodec: 'h264',
  videoMode: 'encode',
  preferHardware: true,
  forceEncoder: null,

  rateControl: 'crf',
  crf: 24,
  cqp: 26,
  videoBitrateKbps: 4000,
  twoPass: false,
  targetSizeMB: 25,
  maxrateKbps: null,
  bufsizeKbps: null,

  preset: 'medium',
  tune: null,
  profile: null,
  level: null,
  pixelFormat: 'auto',
  bitDepth: 8,
  gopSize: null,
  keyintMin: null,
  bFrames: null,

  resolution: 'original',
  customWidth: null,
  customHeight: null,
  noUpscale: true,
  scaleFlags: 'bicubic',
  fps: null,

  audioMode: 'encode',
  audioCodec: 'aac',
  audioBitrateKbps: 128,
  audioChannels: null,
  audioSampleRate: null,

  trimStartSec: null,
  trimEndSec: null,
  crop: null,
  rotate: 0,
  flipH: false,
  flipV: false,
  deinterlace: false,
  denoise: 'none',
  sharpen: false,

  subtitleMode: 'none',
  subtitlePath: null,
  subtitleStreamIndex: null,

  threads: null,
  extraArgs: ''
}
