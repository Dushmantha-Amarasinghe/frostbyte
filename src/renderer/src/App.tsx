import { useEffect } from 'react'
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { TitleBar } from './components/TitleBar'
import { Sidebar } from './components/Sidebar'
import { Simple } from './routes/Simple'
import { Queue } from './routes/Queue'
import { Watch } from './routes/Watch'
import { Settings } from './routes/Settings'
import { About } from './routes/About'
import { useAppStore } from './store/appStore'
import { useQueueStore } from './store/queueStore'
import { useWatchStore } from './store/watchStore'

function AnimatedRoutes(): React.JSX.Element {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
        className="h-full"
      >
        <Routes location={location}>
          <Route path="/" element={<Simple />} />
          <Route path="/queue" element={<Queue />} />
          <Route path="/watch" element={<Watch />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/about" element={<About />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  )
}

function App(): React.JSX.Element {
  const { setCaps, setOutputConfig, setAppInfo, setUpdateInfo } = useAppStore()
  const { setItems, applyProgress } = useQueueStore()
  const { setViews, setActivity } = useWatchStore()

  useEffect(() => {
    window.frostbyte.detectEncoders().then(setCaps).catch(() => {})
    window.frostbyte.getOutputConfig().then(setOutputConfig).catch(() => {})
    window.frostbyte.appInfo().then(setAppInfo).catch(() => {})
    window.frostbyte.queueSnapshot().then(setItems).catch(() => {})
    window.frostbyte.watchList().then(setViews).catch(() => {})
    const offChanged = window.frostbyte.onQueueChanged(setItems)
    const offProgress = window.frostbyte.onJobProgress(applyProgress)
    const offWatchChanged = window.frostbyte.onWatchChanged(setViews)
    const offWatchActivity = window.frostbyte.onWatchActivity(setActivity)
    const offUpdateAvailable = window.frostbyte.onUpdateAvailable(setUpdateInfo)
    return () => {
      offChanged()
      offProgress()
      offWatchChanged()
      offWatchActivity()
      offUpdateAvailable()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <HashRouter>
      <div className="backdrop" />
      <div className="relative z-10 flex h-full flex-col">
        <TitleBar />
        <div className="flex min-h-0 flex-1">
          <Sidebar />
          <main className="min-w-0 flex-1 overflow-y-auto">
            <AnimatedRoutes />
          </main>
        </div>
      </div>
    </HashRouter>
  )
}

export default App
