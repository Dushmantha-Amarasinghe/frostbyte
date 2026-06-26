import { CompressionSettings } from './settings'
import { EncoderCapabilities } from './encoders'
import { WatchFolder, WatchFileRecord, WatchFolderStats } from './watch'

export interface MediaInfo {
  path: string
  name: string
  sizeBytes: number
  durationSec: number
  width: number
  height: number
  fps: number
  vcodec: string
  acodec: string | null
  pixFmt: string
  bitDepth: 8 | 10
  hasAudio: boolean
  hasSubtitles: boolean
}

export interface ProgressEvent {
  id: string
  percent: number
  fps: number
  speed: number
  outTimeSec: number
  bitrateKbps: number
  etaSec: number | null
  frame: number
  pass?: 1 | 2
}

export type QueueItemStatus = 'queued' | 'running' | 'done' | 'error' | 'cancelled'

export interface JobResult {
  outputPath: string
  outputSizeBytes: number
  inputSizeBytes: number
  savedPercent: number
  elapsedSec: number
}

export interface QueueItem {
  id: string
  info: MediaInfo
  settings: CompressionSettings
  rawArgsOverride: string | null
  outputPath: string
  status: QueueItemStatus
  progress: ProgressEvent | null
  result: JobResult | null
  error: string | null
}

export interface OutputConfig {
  /** Folder; null means "same folder as source". */
  folder: string | null
  /** Filename template with {name} {date} {codec} {res} {preset} tokens. */
  template: string
  /** Hide to tray on window close instead of quitting. */
  enableTray?: boolean
}

export interface UpdateCheckResult {
  currentVersion: string
  latestVersion: string | null
  updateAvailable: boolean
  releaseUrl: string | null
  releaseNotes: string | null
  error: string | null
}

export interface AppInfo {
  version: string
  ffmpegVersion: string
}

// ---- Watch folders ----

/** Live status of the watch processor (one item at a time). */
export interface WatchActivity {
  folderId: string
  fingerprint: string
  name: string
  progress: ProgressEvent | null
  /** Why processing is currently paused, if it is (e.g. outside quiet hours). */
  waitingReason: string | null
}

/** A folder plus its file records and rollup, for the renderer. */
export interface WatchFolderView {
  folder: WatchFolder
  files: WatchFileRecord[]
  stats: WatchFolderStats
}

// ---- Channel names (single source of truth) ----
export const IPC = {
  openFiles: 'dialog:openFiles',
  chooseOutputDir: 'dialog:chooseOutputDir',
  probeFile: 'probe:file',
  detectEncoders: 'encoders:detect',
  commandPreview: 'command:preview',
  queueAdd: 'queue:add',
  queueUpdateItem: 'queue:updateItem',
  queueRemove: 'queue:remove',
  queueReorder: 'queue:reorder',
  queueStart: 'queue:start',
  queuePause: 'queue:pause',
  queueCancelItem: 'queue:cancelItem',
  queueCancelAll: 'queue:cancelAll',
  queueSnapshot: 'queue:snapshot',
  getOutputConfig: 'settings:getOutputConfig',
  setOutputConfig: 'settings:setOutputConfig',
  updateCheck: 'update:check',
  revealFile: 'shell:revealFile',
  appInfo: 'app:getInfo',
  // watch folders
  watchList: 'watch:list',
  watchAdd: 'watch:add',
  watchUpdate: 'watch:update',
  watchRemove: 'watch:remove',
  watchToggle: 'watch:toggle',
  watchRetryFile: 'watch:retryFile',
  watchChooseFolder: 'watch:chooseFolder',
  // events (main -> renderer)
  evtJobProgress: 'job:progress',
  evtJobStart: 'job:start',
  evtJobComplete: 'job:complete',
  evtJobError: 'job:error',
  evtQueueChanged: 'queue:changed',
  evtWatchChanged: 'watch:changed',
  evtWatchActivity: 'watch:activity'
} as const

export interface CommandPreviewResult {
  args: string[]
  display: string
}

export type { CompressionSettings, EncoderCapabilities }
export type { WatchFolder, WatchFileRecord, WatchFolderStats }
