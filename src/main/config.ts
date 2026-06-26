import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { OutputConfig } from '@shared/ipc-contract'
import { DEFAULT_OUTPUT_CONFIG } from './output'

function file(): string {
  return join(app.getPath('userData'), 'output-config.json')
}

export function isFirstLaunch(): boolean {
  return !existsSync(file())
}

export function loadOutputConfig(): OutputConfig {
  try {
    if (existsSync(file())) {
      return { ...DEFAULT_OUTPUT_CONFIG, ...JSON.parse(readFileSync(file(), 'utf8')) }
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_OUTPUT_CONFIG }
}

export function saveOutputConfig(c: OutputConfig): void {
  try {
    writeFileSync(file(), JSON.stringify(c, null, 2))
  } catch {
    /* ignore */
  }
}
