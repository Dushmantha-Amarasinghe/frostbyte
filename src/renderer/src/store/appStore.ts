import { create } from 'zustand'
import { EncoderCapabilities, EMPTY_CAPS } from '@shared/encoders'
import { OutputConfig, AppInfo, UpdateCheckResult } from '@shared/ipc-contract'

interface AppState {
  caps: EncoderCapabilities
  capsLoaded: boolean
  outputConfig: OutputConfig
  appInfo: AppInfo | null
  updateInfo: UpdateCheckResult | null
  setCaps: (c: EncoderCapabilities) => void
  setOutputConfig: (c: OutputConfig) => void
  setAppInfo: (i: AppInfo) => void
  setUpdateInfo: (u: UpdateCheckResult | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  caps: EMPTY_CAPS,
  capsLoaded: false,
  outputConfig: { folder: null, template: '{name}_frostbyte' },
  appInfo: null,
  updateInfo: null,
  setCaps: (caps) => set({ caps, capsLoaded: true }),
  setOutputConfig: (outputConfig) => set({ outputConfig }),
  setAppInfo: (appInfo) => set({ appInfo }),
  setUpdateInfo: (updateInfo) => set({ updateInfo })
}))
