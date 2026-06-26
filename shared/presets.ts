import { CompressionSettings } from './settings'

export interface SimplePreset {
  id: string
  name: string
  description: string
  icon: 'snowflake' | 'gauge' | 'bolt' | 'message' | 'monitor' | 'globe' | 'film' | 'music'
  settings: Partial<CompressionSettings>
}

// All presets prefer hardware encoding for speed; fall back to software automatically.
export const SIMPLE_PRESETS: SimplePreset[] = [
  {
    id: 'fast',
    name: 'Fast',
    description: 'Quick · hardware',
    icon: 'bolt',
    settings: {
      videoCodec: 'h264',
      preferHardware: true,
      rateControl: 'crf',
      crf: 26,
      cqp: 28,
      preset: 'veryfast',
      resolution: '1080p',
      noUpscale: true,
      audioBitrateKbps: 128
    }
  },
  {
    id: 'balanced',
    name: 'Balanced',
    description: 'Good size & quality',
    icon: 'gauge',
    settings: {
      videoCodec: 'h264',
      rateControl: 'crf',
      crf: 23,
      preset: 'medium',
      resolution: 'original',
      audioBitrateKbps: 128
    }
  },
  {
    id: 'smallest',
    name: 'Smallest',
    description: 'HEVC · tiniest file',
    icon: 'snowflake',
    settings: {
      videoCodec: 'hevc',
      rateControl: 'crf',
      crf: 28,
      preset: 'slow',
      resolution: '1080p',
      noUpscale: true,
      audioBitrateKbps: 96
    }
  },
  {
    id: 'discord10',
    name: 'Discord 10 MB',
    description: 'Fit under 10 MB',
    icon: 'message',
    settings: {
      videoCodec: 'h264',
      rateControl: 'targetSize',
      twoPass: true,
      targetSizeMB: 10,
      resolution: '1080p',
      noUpscale: true,
      audioBitrateKbps: 96
    }
  },
  {
    id: 'discord25',
    name: 'Discord 25 MB',
    description: 'Fit under 25 MB',
    icon: 'message',
    settings: {
      videoCodec: 'h264',
      rateControl: 'targetSize',
      twoPass: true,
      targetSizeMB: 25,
      resolution: '1080p',
      audioBitrateKbps: 128
    }
  },
  {
    id: 'to1080p',
    name: '4K → 1080p',
    description: 'Downscale to 1080p',
    icon: 'monitor',
    settings: {
      videoCodec: 'h264',
      rateControl: 'crf',
      crf: 23,
      preset: 'medium',
      resolution: '1080p',
      noUpscale: true
    }
  },
  {
    id: 'tomp4',
    name: 'Convert to MP4',
    description: 'Remux · very fast',
    icon: 'film',
    settings: {
      container: 'mp4',
      videoCodec: 'copy',
      audioMode: 'copy',
      faststart: true
    }
  },
  {
    id: 'web',
    name: 'Web Optimized',
    description: 'Streaming-ready MP4',
    icon: 'globe',
    settings: {
      container: 'mp4',
      videoCodec: 'h264',
      rateControl: 'crf',
      crf: 23,
      preset: 'medium',
      pixelFormat: 'yuv420p',
      profile: 'high',
      faststart: true
    }
  },
  {
    id: 'audiomp3',
    name: 'Audio (MP3)',
    description: 'Extract audio only',
    icon: 'music',
    settings: {
      videoMode: 'none',
      audioMode: 'encode',
      audioCodec: 'mp3',
      audioBitrateKbps: 192
    }
  }
]

export const DEFAULT_PRESET_ID = 'fast'
