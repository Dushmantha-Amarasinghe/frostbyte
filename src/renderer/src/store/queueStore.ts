import { create } from 'zustand'
import { QueueItem, ProgressEvent } from '@shared/ipc-contract'

interface QueueState {
  items: QueueItem[]
  setItems: (items: QueueItem[]) => void
  applyProgress: (e: ProgressEvent) => void
}

export const useQueueStore = create<QueueState>((set, get) => ({
  items: [],
  setItems: (items) => set({ items }),
  applyProgress: (e) =>
    set({
      items: get().items.map((it) => (it.id === e.id ? { ...it, progress: e } : it))
    })
}))
