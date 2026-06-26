import { app, shell, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registerIpc } from './ipc'
import { detectEncoders } from './encoder-detect'
import { loadOutputConfig } from './config'
import type { WatchService } from './watch-service'

let mainWindow: BrowserWindow | null = null
let watchService: WatchService | null = null
let tray: Tray | null = null

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
    if (tray) {
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

  watchService = registerIpc(() => mainWindow, applyTray)
  createWindow()

  // Warm the encoder cache so the UI knows hardware support quickly.
  detectEncoders().catch(() => {})

  // Re-arm persisted watch folders and start the schedule-gated runner.
  watchService.init().catch(() => {})

  // Restore tray state from persisted config.
  applyTray(loadOutputConfig().enableTray ?? false)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  watchService?.shutdown()
  if (process.platform !== 'darwin') app.quit()
})
