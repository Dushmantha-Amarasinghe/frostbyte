import { randomUUID } from 'crypto'
import { CompressionSettings, DEFAULT_SETTINGS } from '@shared/settings'
import { SIMPLE_PRESETS } from '@shared/presets'
import { WatchFolder, DEFAULT_WATCH_FOLDER } from '@shared/watch'
import { WatchActivity, WatchFolderView } from '@shared/ipc-contract'
import { Ledger } from './ledger'
import { Watcher } from './watcher'
import { WatchRunner } from './watch-runner'

type EmitChanged = (views: WatchFolderView[]) => void
type EmitActivity = (activity: WatchActivity | null) => void

export interface NewFolderInput {
  path: string
  scope?: WatchFolder['scope']
  mode?: WatchFolder['mode']
  safeDelete?: WatchFolder['safeDelete']
  holdDays?: number
  presetId?: string | null
  settings?: CompressionSettings
  schedule?: WatchFolder['schedule']
  minSavingsPercent?: number
}

/** Resolves a CompressionSettings profile from a preset id (falls back to defaults). */
export function settingsFromPreset(presetId: string | null): CompressionSettings {
  const preset = SIMPLE_PRESETS.find((p) => p.id === presetId)
  return { ...DEFAULT_SETTINGS, ...(preset?.settings ?? {}) }
}

/**
 * Owns the whole Watch subsystem: the ledger, the chokidar watcher, and the
 * schedule-gated runner. IPC handlers call into this; it emits view snapshots.
 */
export class WatchService {
  private ledger = new Ledger()
  private watcher: Watcher
  private runner: WatchRunner

  constructor(
    private emitChanged: EmitChanged,
    emitActivity: EmitActivity
  ) {
    const changed = (): void => this.emitChanged(this.views())
    this.watcher = new Watcher(this.ledger, () => this.runner.kick(), changed)
    this.runner = new WatchRunner(this.ledger, emitActivity, changed)
  }

  /** Re-arm persisted folders on startup. */
  async init(): Promise<void> {
    this.runner.start()
    for (const folder of this.ledger.listFolders()) {
      await this.watcher.arm(folder).catch(() => {})
    }
    this.emitChanged(this.views())
  }

  views(): WatchFolderView[] {
    return this.ledger.listFolders().map((folder) => ({
      folder,
      files: this.ledger.listFiles(folder.id),
      stats: this.ledger.stats(folder.id)
    }))
  }

  async addFolder(input: NewFolderInput): Promise<WatchFolderView[]> {
    const presetId = input.presetId ?? DEFAULT_WATCH_FOLDER.presetId
    const folder: WatchFolder = {
      id: randomUUID(),
      path: input.path,
      enabled: true,
      scope: input.scope ?? DEFAULT_WATCH_FOLDER.scope,
      mode: input.mode ?? DEFAULT_WATCH_FOLDER.mode,
      safeDelete: input.safeDelete ?? DEFAULT_WATCH_FOLDER.safeDelete,
      holdDays: input.holdDays ?? DEFAULT_WATCH_FOLDER.holdDays,
      presetId,
      settings: input.settings ?? settingsFromPreset(presetId),
      schedule: input.schedule ?? DEFAULT_WATCH_FOLDER.schedule,
      minSavingsPercent: input.minSavingsPercent ?? DEFAULT_WATCH_FOLDER.minSavingsPercent
    }
    this.ledger.saveFolder(folder)
    await this.watcher.arm(folder)
    this.emitChanged(this.views())
    return this.views()
  }

  async updateFolder(id: string, patch: Partial<WatchFolder>): Promise<WatchFolderView[]> {
    const existing = this.ledger.getFolder(id)
    if (!existing) return this.views()
    // If a preset id changed and no explicit settings provided, re-resolve settings.
    let settings = patch.settings ?? existing.settings
    if (patch.presetId !== undefined && patch.presetId !== null && patch.settings === undefined) {
      settings = settingsFromPreset(patch.presetId)
    }
    const next: WatchFolder = { ...existing, ...patch, settings, id }
    this.ledger.saveFolder(next)
    await this.watcher.arm(next) // re-arm with new scope/settings
    this.emitChanged(this.views())
    return this.views()
  }

  async toggleFolder(id: string, enabled: boolean): Promise<WatchFolderView[]> {
    return this.updateFolder(id, { enabled })
  }

  removeFolder(id: string): WatchFolderView[] {
    this.watcher.disarm(id)
    this.ledger.deleteFolder(id)
    const views = this.views()
    this.emitChanged(views)
    return views
  }

  /** Re-queue a skipped/errored file so it's retried on the next drain. */
  retryFile(fingerprint: string): WatchFolderView[] {
    this.ledger.markStatus(fingerprint, 'queued', { reason: null })
    this.runner.kick()
    const views = this.views()
    this.emitChanged(views)
    return views
  }

  setBackgroundMode(enabled: boolean): void {
    this.runner.setBackgroundMode(enabled)
  }

  pause(): void {
    this.runner.pause()
  }

  resume(): void {
    this.runner.resume()
  }

  shutdown(): void {
    this.runner.stop()
    this.watcher.closeAll()
    this.ledger.close()
  }
}
