import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { CompressionSettings, DEFAULT_SETTINGS } from '@shared/settings'
import { SIMPLE_PRESETS, DEFAULT_PRESET_ID } from '@shared/presets'

interface SettingsState {
  settings: CompressionSettings
  activePresetId: string | null
  set: <K extends keyof CompressionSettings>(key: K, value: CompressionSettings[K]) => void
  patch: (partial: Partial<CompressionSettings>) => void
  applyPreset: (id: string) => void
  reset: () => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      settings: { ...DEFAULT_SETTINGS },
      activePresetId: DEFAULT_PRESET_ID,
      set: (key, value) =>
        set({ settings: { ...get().settings, [key]: value }, activePresetId: null }),
      patch: (partial) =>
        set({ settings: { ...get().settings, ...partial }, activePresetId: null }),
      applyPreset: (id) => {
        const preset = SIMPLE_PRESETS.find((p) => p.id === id)
        if (!preset) return
        set({
          settings: { ...DEFAULT_SETTINGS, ...preset.settings },
          activePresetId: id
        })
      },
      reset: () => set({ settings: { ...DEFAULT_SETTINGS }, activePresetId: DEFAULT_PRESET_ID })
    }),
    { name: 'frostbyte-desktop-settings-v1' }
  )
)
