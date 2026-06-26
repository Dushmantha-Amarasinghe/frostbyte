import { create } from 'zustand'
import { EncoderCapabilities, EMPTY_CAPS } from '@shared/encoders'
import { OutputConfig, AppInfo } from '@shared/ipc-contract'

interface AppState {
  caps: EncoderCapabilities
  capsLoaded: boolean
  outputConfig: OutputConfig
  appInfo: AppInfo | null
  setCaps: (c: EncoderCapabilities) => void
  setOutputConfig: (c: OutputConfig) => void
  setAppInfo: (i: AppInfo) => void
}

export const useAppStore = create<AppState>((set) => ({
  caps: EMPTY_CAPS,
  capsLoaded: false,
  outputConfig: { folder: null, template: '{name}_frostbyte' },
  appInfo: null,
  setCaps: (caps) => set({ caps, capsLoaded: true }),
  setOutputConfig: (outputConfig) => set({ outputConfig }),
  setAppInfo: (appInfo) => set({ appInfo })
}))
