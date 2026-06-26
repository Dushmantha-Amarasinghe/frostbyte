import { dirname, join, basename, extname } from 'path'
import { existsSync } from 'fs'
import { CompressionSettings, AUDIO_EXT } from '@shared/settings'
import { MediaInfo, OutputConfig } from '@shared/ipc-contract'

export const DEFAULT_OUTPUT_CONFIG: OutputConfig = {
  folder: null,
  template: '{name}_frostbyte'
}

function sanitize(name: string): string {
  return (
    name
      .normalize('NFKD')
      .replace(/[^a-zA-Z0-9-_ ]+/g, '_')
      .replace(/\s+/g, ' ')
      .replace(/_+/g, '_')
      .trim()
      .slice(0, 80) || 'video'
  )
}

function resLabel(s: CompressionSettings): string {
  return s.resolution === 'original' ? 'src' : s.resolution
}

export function resolveOutputPath(
  info: MediaInfo,
  settings: CompressionSettings,
  config: OutputConfig
): string {
  const dir = config.folder || dirname(info.path)
  // Audio-only export uses an audio container; otherwise the chosen video container.
  const ext = settings.videoMode === 'none' ? AUDIO_EXT[settings.audioCodec] : settings.container
  const stem = basename(info.path, extname(info.path))
  const date = new Date().toISOString().slice(0, 10)

  let name = (config.template || '{name}_frostbyte')
    .replace(/{name}/g, stem)
    .replace(/{date}/g, date)
    .replace(/{codec}/g, settings.videoCodec)
    .replace(/{res}/g, resLabel(settings))
    .replace(/{preset}/g, settings.preset)

  name = sanitize(name)

  let candidate = join(dir, `${name}.${ext}`)
  let i = 1
  while (existsSync(candidate)) {
    candidate = join(dir, `${name} (${i}).${ext}`)
    i++
  }
  return candidate
}
