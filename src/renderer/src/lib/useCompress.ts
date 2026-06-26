import { useNavigate } from 'react-router-dom'
import { useFilesStore } from '@renderer/store/filesStore'
import { useSettingsStore } from '@renderer/store/settingsStore'

/** Adds the pending files to the queue with current settings, starts it, and navigates. */
export function useCompress(): { compress: () => Promise<void>; canCompress: boolean } {
  const navigate = useNavigate()
  const files = useFilesStore((s) => s.files)
  const clear = useFilesStore((s) => s.clear)
  const settings = useSettingsStore((s) => s.settings)

  const compress = async (): Promise<void> => {
    if (!files.length) return
    await window.frostbyte.queueAdd(files, settings)
    await window.frostbyte.queueStart()
    clear()
    navigate('/queue')
  }

  return { compress, canCompress: files.length > 0 }
}
