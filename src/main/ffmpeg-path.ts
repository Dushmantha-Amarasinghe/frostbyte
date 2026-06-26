import { app } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'

let overridePath: string | null = null

export function setFfmpegOverride(dir: string | null): void {
  overridePath = dir
}

function baseDir(): string {
  if (overridePath) return overridePath
  return app.isPackaged
    ? join(process.resourcesPath, 'ffmpeg')
    : join(process.cwd(), 'resources', 'ffmpeg')
}

export function ffmpegPath(): string {
  return join(baseDir(), 'ffmpeg.exe')
}

export function ffprobePath(): string {
  return join(baseDir(), 'ffprobe.exe')
}

export function ffmpegAvailable(): boolean {
  return existsSync(ffmpegPath()) && existsSync(ffprobePath())
}
