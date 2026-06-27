import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { RefreshCw, CheckCircle2, Download, Cpu, ExternalLink, Coffee, ArrowDownToLine } from 'lucide-react'
import { Snowflake } from '@renderer/components/Snowflake'
import { Button, Label } from '@renderer/components/ui'
import { ProgressBar } from '@renderer/components/ProgressBar'
import { useAppStore } from '@renderer/store/appStore'
import { UpdateCheckResult } from '@shared/ipc-contract'
import { cn } from '@renderer/lib/utils'

type DownloadState = 'idle' | 'downloading' | 'ready'

export function About(): React.JSX.Element {
  const { appInfo, caps, updateInfo, setUpdateInfo } = useAppStore()
  const [checking, setChecking] = useState(false)
  const [localUpdate, setLocalUpdate] = useState<UpdateCheckResult | null>(updateInfo)
  const [downloadState, setDownloadState] = useState<DownloadState>('idle')
  const [downloadPercent, setDownloadPercent] = useState(0)

  // Keep local state in sync when background check fires
  useEffect(() => {
    if (updateInfo) setLocalUpdate(updateInfo)
  }, [updateInfo])

  // Subscribe to download progress
  useEffect(() => {
    const off = window.frostbyte.onUpdateProgress((pct) => setDownloadPercent(pct))
    return off
  }, [])

  const checkUpdate = async (): Promise<void> => {
    setChecking(true)
    try {
      const result = await window.frostbyte.checkUpdate()
      setLocalUpdate(result)
      if (result.updateAvailable) setUpdateInfo(result)
    } finally {
      setChecking(false)
    }
  }

  const startDownload = async (): Promise<void> => {
    if (!localUpdate?.downloadUrl) return
    setDownloadState('downloading')
    setDownloadPercent(0)
    try {
      await window.frostbyte.downloadAndInstall(localUpdate.downloadUrl)
      setDownloadState('ready')
    } catch {
      setDownloadState('idle')
    }
  }

  const hwList = [
    caps.nvenc.h264 && 'NVIDIA NVENC',
    caps.qsv.h264 && 'Intel Quick Sync',
    caps.amf.h264 && 'AMD AMF'
  ].filter(Boolean) as string[]

  const hasUpdate = localUpdate?.updateAvailable && localUpdate.downloadUrl

  return (
    <div className="mx-auto max-w-2xl px-10 py-9">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center py-6 text-center"
      >
        <motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}>
          <Snowflake size={68} glow />
        </motion.div>
        <h1 className="mt-5 font-display text-3xl font-semibold tracking-tight text-text">Frostbyte</h1>
        <div className="mt-2 font-mono text-[11px] uppercase tracking-[0.24em] text-frostDim">
          video compressor · v{appInfo?.version ?? '1.0.0'}
        </div>
      </motion.div>

      <Section title="System" icon={<Cpu size={15} className="text-frost" />}>
        <InfoRow label="FFmpeg" value={appInfo?.ffmpegVersion ?? '…'} />
        <InfoRow label="Hardware encoders" value={hwList.length ? hwList.join(' · ') : 'Software only'} />
      </Section>

      <Section title="Updates">
        {/* Status row */}
        <div className="flex items-center justify-between">
          <div>
            <Label>Latest release</Label>
            {localUpdate && !localUpdate.error && (
              <div className="mt-0.5 text-xs text-textFaint">
                {localUpdate.updateAvailable
                  ? `v${localUpdate.latestVersion} available`
                  : `v${localUpdate.latestVersion} · you're up to date`}
              </div>
            )}
            {localUpdate?.error && (
              <div className="mt-0.5 text-xs text-textFaint">{localUpdate.error}</div>
            )}
          </div>
          <Button onClick={checkUpdate} disabled={checking || downloadState === 'downloading'}>
            <RefreshCw size={15} className={cn(checking && 'animate-spin')} />
            Check now
          </Button>
        </div>

        {/* Update available — download/install */}
        {hasUpdate && downloadState === 'idle' && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 flex items-center justify-between rounded-lg border border-frost/20 bg-frost/[0.06] px-4 py-3"
          >
            <div className="flex items-center gap-2.5">
              <Download size={16} className="text-frost" />
              <div>
                <div className="text-sm font-semibold text-text">
                  v{localUpdate.latestVersion} is ready
                </div>
                <div className="text-xs text-textFaint">Downloads and installs automatically</div>
              </div>
            </div>
            <Button variant="primary" onClick={startDownload}>
              <ArrowDownToLine size={15} />
              Update
            </Button>
          </motion.div>
        )}

        {/* Downloading progress */}
        {downloadState === 'downloading' && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-textDim">
              <span>Downloading v{localUpdate?.latestVersion}…</span>
              <span className="font-mono">{downloadPercent}%</span>
            </div>
            <ProgressBar percent={downloadPercent} />
            <div className="text-xs text-textFaint">
              The installer will open automatically when ready
            </div>
          </div>
        )}

        {/* Already up to date */}
        {localUpdate && !localUpdate.updateAvailable && !localUpdate.error && downloadState === 'idle' && (
          <div className="mt-3 flex items-center gap-2 text-sm text-textDim">
            <CheckCircle2 size={16} className="text-frost" />
            You&apos;re on the latest version
          </div>
        )}

        <div className="mt-3 text-[11px] text-textFaint">
          Checked automatically on startup and every 24 hours
        </div>
      </Section>

      <Section title="Made by">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-text">Dushmantha Amarasinghe</div>
            <div className="mt-0.5 text-xs text-textFaint">Built with FFmpeg + Electron + React</div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="https://github.com/Dushmantha-Amarasinghe"
              onClick={(e) => { e.preventDefault(); window.open('https://github.com/Dushmantha-Amarasinghe') }}
              className="no-drag flex items-center gap-1.5 rounded-md border border-white/10 bg-panel2 px-3 py-2 text-xs text-textDim transition-colors hover:border-white/20 hover:text-text"
            >
              <ExternalLink size={13} />
              GitHub
            </a>
            <a
              href="https://ko-fi.com/dushmantha"
              onClick={(e) => { e.preventDefault(); window.open('https://ko-fi.com/dushmantha') }}
              className="no-drag flex items-center gap-1.5 rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs font-medium text-amber-400 transition-colors hover:bg-amber-400/20 hover:text-amber-300"
            >
              <Coffee size={13} />
              Buy me a coffee
            </a>
          </div>
        </div>
      </Section>

      <p className="mt-7 text-center font-mono text-[11px] leading-relaxed text-textFaint">
        Powered by FFmpeg (GPL). Bundled FFmpeg binaries are licensed under the GPL.
      </p>
    </div>
  )
}

function Section({
  title,
  icon,
  children
}: {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="mt-4 rounded-lg glass p-5">
      <h2 className="mb-4 flex items-center gap-2 font-display text-base font-semibold tracking-tight text-text">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  )
}

function InfoRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="flex items-center justify-between border-t border-line py-2.5 first:border-t-0">
      <span className="text-sm text-textDim">{label}</span>
      <span className="max-w-[60%] truncate font-mono text-xs text-text">{value}</span>
    </div>
  )
}
