import { ElectronAPI } from '@electron-toolkit/preload'
import { FrostbyteApi } from './index'

declare global {
  interface Window {
    electron: ElectronAPI
    frostbyte: FrostbyteApi
  }
}
