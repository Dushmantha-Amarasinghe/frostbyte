import { ipcMain, dialog, shell, BrowserWindow, app } from 'electron'
import { IPC, OutputConfig, CommandPreviewResult, MediaInfo } from '@shared/ipc-contract'
import { WatchFolder } from '@shared/watch'
import { CompressionSettings } from '@shared/settings'
import { probe, ffmpegVersion } from './ffprobe'
import { detectEncoders, cachedCaps } from './encoder-detect'
import { buildFFmpegArgs, argsToDisplay } from '@shared/command-builder'
import { resolveOutputPath } from './output'
import { checkForUpdate } from './updater'
import { ffmpegPath } from './ffmpeg-path'
import { loadOutputConfig, saveOutputConfig } from './config'
import { Queue } from './queue'
import { WatchService, NewFolderInput } from './watch-service'

const VIDEO_FILTERS = [
  { name: 'Video', extensions: ['mp4', 'mov', 'mkv', 'webm', 'avi', 'm4v', 'flv', 'wmv', 'ts', 'mpg', 'mpeg', '3gp'] },
  { name: 'All Files', extensions: ['*'] }
]

export function registerIpc(
  getWindow: () => BrowserWindow | null,
  onTrayToggle: (enabled: boolean) => void
): WatchService {
  let outputConfig: OutputConfig = loadOutputConfig()
  const emit = (channel: string, payload: unknown): void => {
    getWindow()?.webContents.send(channel, payload)
  }
  const queue = new Queue(emit, outputConfig)
  const watch = new WatchService(
    (views) => emit(IPC.evtWatchChanged, views),
    (activity) => emit(IPC.evtWatchActivity, activity)
  )

  ipcMain.handle(IPC.openFiles, async () => {
    const win = getWindow()
    const res = win
      ? await dialog.showOpenDialog(win, {
          properties: ['openFile', 'multiSelections'],
          filters: VIDEO_FILTERS
        })
      : await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'], filters: VIDEO_FILTERS })
    return res.canceled ? [] : res.filePaths
  })

  ipcMain.handle(IPC.chooseOutputDir, async () => {
    const win = getWindow()
    const res = win
      ? await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] })
      : await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
    return res.canceled || !res.filePaths.length ? null : res.filePaths[0]
  })

  ipcMain.handle(IPC.probeFile, async (_e, { path }: { path: string }) => probe(path))

  ipcMain.handle(IPC.detectEncoders, async (_e, { force }: { force?: boolean } = {}) =>
    detectEncoders(force)
  )

  ipcMain.handle(
    IPC.commandPreview,
    async (
      _e,
      { settings, input, outputPath }: { settings: CompressionSettings; input: MediaInfo; outputPath?: string }
    ): Promise<CommandPreviewResult> => {
      const out = outputPath || resolveOutputPath(input, settings, outputConfig)
      const args = buildFFmpegArgs(settings, input, out, cachedCaps())
      return { args, display: argsToDisplay(args) }
    }
  )

  ipcMain.handle(
    IPC.queueAdd,
    async (_e, { infos, settings }: { infos: MediaInfo[]; settings: CompressionSettings }) =>
      queue.add(infos, settings)
  )

  ipcMain.handle(
    IPC.queueUpdateItem,
    async (
      _e,
      { id, settings, rawArgsOverride }: { id: string; settings: CompressionSettings; rawArgsOverride?: string | null }
    ) => queue.updateItem(id, settings, rawArgsOverride)
  )

  ipcMain.handle(IPC.queueRemove, async (_e, { id }: { id: string }) => queue.remove(id))
  ipcMain.handle(IPC.queueReorder, async (_e, { ids }: { ids: string[] }) => queue.reorder(ids))
  ipcMain.handle(IPC.queueStart, async () => queue.start())
  ipcMain.handle(IPC.queuePause, async () => queue.pause())
  ipcMain.handle(IPC.queueCancelItem, async (_e, { id }: { id: string }) => queue.cancelItem(id))
  ipcMain.handle(IPC.queueCancelAll, async () => queue.cancelAll())
  ipcMain.handle(IPC.queueSnapshot, async () => queue.snapshot())

  ipcMain.handle(IPC.getOutputConfig, async () => outputConfig)
  ipcMain.handle(IPC.setOutputConfig, async (_e, c: OutputConfig) => {
    outputConfig = c
    queue.setOutputConfig(c)
    saveOutputConfig(c)
    onTrayToggle(c.enableTray ?? false)
  })

  ipcMain.handle(IPC.updateCheck, async () => checkForUpdate())
  ipcMain.handle(IPC.revealFile, async (_e, { path }: { path: string }) => shell.showItemInFolder(path))
  ipcMain.handle(IPC.appInfo, async () => ({
    version: app.getVersion(),
    ffmpegVersion: await ffmpegVersion(ffmpegPath())
  }))

  // ---- Watch folders ----
  ipcMain.handle(IPC.watchChooseFolder, async () => {
    const win = getWindow()
    const res = win
      ? await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] })
      : await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
    return res.canceled || !res.filePaths.length ? null : res.filePaths[0]
  })
  ipcMain.handle(IPC.watchList, async () => watch.views())
  ipcMain.handle(IPC.watchAdd, async (_e, input: NewFolderInput) => watch.addFolder(input))
  ipcMain.handle(IPC.watchUpdate, async (_e, { id, patch }: { id: string; patch: Partial<WatchFolder> }) =>
    watch.updateFolder(id, patch)
  )
  ipcMain.handle(IPC.watchToggle, async (_e, { id, enabled }: { id: string; enabled: boolean }) =>
    watch.toggleFolder(id, enabled)
  )
  ipcMain.handle(IPC.watchRemove, async (_e, { id }: { id: string }) => watch.removeFolder(id))
  ipcMain.handle(IPC.watchRetryFile, async (_e, { fingerprint }: { fingerprint: string }) =>
    watch.retryFile(fingerprint)
  )

  return watch
}
