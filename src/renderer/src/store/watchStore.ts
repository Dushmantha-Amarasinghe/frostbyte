import { create } from 'zustand'
import { WatchFolderView, WatchActivity } from '@shared/ipc-contract'

interface WatchState {
  views: WatchFolderView[]
  activity: WatchActivity | null
  setViews: (views: WatchFolderView[]) => void
  setActivity: (activity: WatchActivity | null) => void
}

export const useWatchStore = create<WatchState>((set) => ({
  views: [],
  activity: null,
  setViews: (views) => set({ views }),
  setActivity: (activity) => set({ activity })
}))
