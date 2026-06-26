import { contextBridge, ipcRenderer, webUtils } from 'electron'
import {
  IPC,
  MediaInfo,
  QueueItem,
  OutputConfig,
  UpdateCheckResult,
  AppInfo,
  CommandPreviewResult,
  ProgressEvent,
  WatchActivity,
  WatchFolderView
} from '@shared/ipc-contract'
import { WatchFolder } from '@shared/watch'
import { CompressionSettings } from '@shared/settings'
import { EncoderCapabilities } from '@shared/encoders'

function on<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_e: unknown, payload: T): void => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const frostbyte = {
  // dialogs
  openFiles: (): Promise<string[]> => ipcRenderer.invoke(IPC.openFiles),
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),
  chooseOutputDir: (): Promise<string | null> => ipcRenderer.invoke(IPC.chooseOutputDir),
  revealFile: (path: string): Promise<void> => ipcRenderer.invoke(IPC.revealFile, { path }),

  // probing / encoders
  probeFile: (path: string): Promise<MediaInfo> => ipcRenderer.invoke(IPC.probeFile, { path }),
  detectEncoders: (force?: boolean): Promise<EncoderCapabilities> =>
    ipcRenderer.invoke(IPC.detectEncoders, { force }),

  // command preview
  previewCommand: (p: {
    settings: CompressionSettings
    input: MediaInfo
    outputPath?: string
  }): Promise<CommandPreviewResult> => ipcRenderer.invoke(IPC.commandPreview, p),

  // queue
  queueAdd: (infos: MediaInfo[], settings: CompressionSettings): Promise<QueueItem[]> =>
    ipcRenderer.invoke(IPC.queueAdd, { infos, settings }),
  queueUpdateItem: (
    id: string,
    settings: CompressionSettings,
    rawArgsOverride?: string | null
  ): Promise<void> => ipcRenderer.invoke(IPC.queueUpdateItem, { id, settings, rawArgsOverride }),
  queueRemove: (id: string): Promise<void> => ipcRenderer.invoke(IPC.queueRemove, { id }),
  queueReorder: (ids: string[]): Promise<void> => ipcRenderer.invoke(IPC.queueReorder, { ids }),
  queueStart: (): Promise<void> => ipcRenderer.invoke(IPC.queueStart),
  queuePause: (): Promise<void> => ipcRenderer.invoke(IPC.queuePause),
  queueCancelItem: (id: string): Promise<void> => ipcRenderer.invoke(IPC.queueCancelItem, { id }),
  queueCancelAll: (): Promise<void> => ipcRenderer.invoke(IPC.queueCancelAll),
  queueSnapshot: (): Promise<QueueItem[]> => ipcRenderer.invoke(IPC.queueSnapshot),

  // output config
  getOutputConfig: (): Promise<OutputConfig> => ipcRenderer.invoke(IPC.getOutputConfig),
  setOutputConfig: (c: OutputConfig): Promise<void> => ipcRenderer.invoke(IPC.setOutputConfig, c),

  // updates / info
  checkUpdate: (): Promise<UpdateCheckResult> => ipcRenderer.invoke(IPC.updateCheck),
  downloadAndInstall: (url: string): Promise<void> =>
    ipcRenderer.invoke(IPC.updateDownloadInstall, { url }),
  onUpdateAvailable: (cb: (result: UpdateCheckResult) => void): (() => void) =>
    on<UpdateCheckResult>(IPC.evtUpdateAvailable, cb),
  onUpdateProgress: (cb: (percent: number) => void): (() => void) =>
    on<number>(IPC.evtUpdateProgress, cb),
  appInfo: (): Promise<AppInfo> => ipcRenderer.invoke(IPC.appInfo),
  getStartup: (): Promise<boolean> => ipcRenderer.invoke(IPC.appGetStartup),
  setStartup: (enabled: boolean): Promise<void> => ipcRenderer.invoke(IPC.appSetStartup, { enabled }),

  // watch folders
  watchList: (): Promise<WatchFolderView[]> => ipcRenderer.invoke(IPC.watchList),
  watchChooseFolder: (): Promise<string | null> => ipcRenderer.invoke(IPC.watchChooseFolder),
  watchAdd: (input: {
    path: string
    scope?: WatchFolder['scope']
    mode?: WatchFolder['mode']
    safeDelete?: WatchFolder['safeDelete']
    holdDays?: number
    presetId?: string | null
    settings?: CompressionSettings
    schedule?: WatchFolder['schedule']
    minSavingsPercent?: number
  }): Promise<WatchFolderView[]> => ipcRenderer.invoke(IPC.watchAdd, input),
  watchUpdate: (id: string, patch: Partial<WatchFolder>): Promise<WatchFolderView[]> =>
    ipcRenderer.invoke(IPC.watchUpdate, { id, patch }),
  watchToggle: (id: string, enabled: boolean): Promise<WatchFolderView[]> =>
    ipcRenderer.invoke(IPC.watchToggle, { id, enabled }),
  watchRemove: (id: string): Promise<WatchFolderView[]> => ipcRenderer.invoke(IPC.watchRemove, { id }),
  watchRetryFile: (fingerprint: string): Promise<WatchFolderView[]> =>
    ipcRenderer.invoke(IPC.watchRetryFile, { fingerprint }),
  watchPause: (): Promise<void> => ipcRenderer.invoke(IPC.watchPause),
  watchResume: (): Promise<void> => ipcRenderer.invoke(IPC.watchResume),

  // window controls (frameless titlebar)
  windowMinimize: (): void => ipcRenderer.send('window:minimize'),
  windowMaximize: (): void => ipcRenderer.send('window:maximize'),
  windowClose: (): void => ipcRenderer.send('window:close'),

  // events
  onQueueChanged: (cb: (items: QueueItem[]) => void): (() => void) =>
    on<QueueItem[]>(IPC.evtQueueChanged, cb),
  onJobProgress: (cb: (e: ProgressEvent) => void): (() => void) =>
    on<ProgressEvent>(IPC.evtJobProgress, cb),
  onJobComplete: (cb: (p: { id: string }) => void): (() => void) =>
    on(IPC.evtJobComplete, cb),
  onJobError: (cb: (p: { id: string; message: string }) => void): (() => void) =>
    on(IPC.evtJobError, cb),
  onWatchChanged: (cb: (views: WatchFolderView[]) => void): (() => void) =>
    on<WatchFolderView[]>(IPC.evtWatchChanged, cb),
  onWatchActivity: (cb: (activity: WatchActivity | null) => void): (() => void) =>
    on<WatchActivity | null>(IPC.evtWatchActivity, cb)
}

export type FrostbyteApi = typeof frostbyte

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('frostbyte', frostbyte)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.frostbyte = frostbyte
}
