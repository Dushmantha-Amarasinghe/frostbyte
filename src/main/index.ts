import { app, shell, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from 'electron'
import { execFile } from 'child_process'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registerIpc } from './ipc'
import { detectEncoders } from './encoder-detect'
import { loadOutputConfig, isFirstLaunch } from './config'

let mainWindow: BrowserWindow | null = null
let services: ReturnType<typeof registerIpc> | null = null
let tray: Tray | null = null
let forceQuit = false

function killOrphanedFfmpeg(): Promise<void> {
  return new Promise((resolve) => {
    execFile('taskkill', ['/F', '/IM', 'ffmpeg.exe'], () => resolve())
  })
}

function applyTray(enabled: boolean): void {
  if (enabled && !tray) {
    const img = nativeImage.createFromPath(icon).resize({ width: 16, height: 16 })
    tray = new Tray(img)
    tray.setToolTip('Frostbyte')
    tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: 'Open Frostbyte',
          click: () => {
            mainWindow?.show()
            mainWindow?.focus()
          }
        },
        { type: 'separator' },
        { label: 'Quit', click: () => app.quit() }
      ])
    )
    tray.on('click', () => {
      if (mainWindow?.isVisible()) {
        mainWindow.hide()
      } else {
        mainWindow?.show()
        mainWindow?.focus()
      }
    })
  } else if (!enabled && tray) {
    tray.destroy()
    tray = null
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 880,
    minHeight: 600,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0b0d10',
    autoHideMenuBar: true,
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  mainWindow.on('close', (e) => {
    if (tray && !forceQuit) {
      e.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('app.frostbyte')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Window controls for the custom frameless titlebar.
  ipcMain.on('window:minimize', () => mainWindow?.minimize())
  ipcMain.on('window:maximize', () => {
    if (!mainWindow) return
    mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize()
  })
  ipcMain.on('window:close', () => mainWindow?.close())

  // On first launch (no saved config yet) default both behaviours on.
  const firstLaunch = isFirstLaunch()
  if (firstLaunch) {
    app.setLoginItemSettings({ openAtLogin: true })
  }

  services = registerIpc(() => mainWindow, applyTray)
  createWindow()

  // Sequential startup: kill orphans → detect encoders → init watch runner.
  // Each step must fully complete before the next starts so taskkill cannot
  // accidentally kill the capability-test ffmpeg processes spawned by detectEncoders.
  killOrphanedFfmpeg()
    .finally(() =>
      detectEncoders()
        .catch(() => {})
        .finally(() => services?.watch.init().catch(() => {}))
    )

  // Restore tray state from persisted config (defaults to true for new installs).
  applyTray(loadOutputConfig().enableTray ?? true)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Cancel all running jobs and allow the window to close when quitting.
app.on('before-quit', () => {
  forceQuit = true
  services?.shutdown()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
