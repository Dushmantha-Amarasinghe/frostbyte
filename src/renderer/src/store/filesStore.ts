import { create } from 'zustand'
import { MediaInfo } from '@shared/ipc-contract'

interface FilesState {
  files: MediaInfo[]
  probing: boolean
  setProbing: (v: boolean) => void
  addFiles: (infos: MediaInfo[]) => void
  remove: (path: string) => void
  clear: () => void
}

export const useFilesStore = create<FilesState>((set, get) => ({
  files: [],
  probing: false,
  setProbing: (probing) => set({ probing }),
  addFiles: (infos) => {
    const existing = new Set(get().files.map((f) => f.path))
    const merged = [...get().files, ...infos.filter((i) => !existing.has(i.path))]
    set({ files: merged })
  },
  remove: (path) => set({ files: get().files.filter((f) => f.path !== path) }),
  clear: () => set({ files: [] })
}))

/** Probes a list of paths and adds them to the store. */
export async function probeAndAdd(paths: string[]): Promise<void> {
  if (!paths.length) return
  const store = useFilesStore.getState()
  store.setProbing(true)
  try {
    const infos = await Promise.all(
      paths.map((p) =>
        window.frostbyte.probeFile(p).catch(() => null)
      )
    )
    store.addFiles(infos.filter((i): i is NonNullable<typeof i> => !!i && i.durationSec >= 0))
  } finally {
    store.setProbing(false)
  }
}
