import { useState } from 'react'
import { motion } from 'framer-motion'
import { RefreshCw, CheckCircle2, Download, Cpu, Github, Coffee } from 'lucide-react'
import { Snowflake } from '@renderer/components/Snowflake'
import { Button, Label } from '@renderer/components/ui'
import { useAppStore } from '@renderer/store/appStore'
import { UpdateCheckResult } from '@shared/ipc-contract'
import { cn } from '@renderer/lib/utils'

export function About(): React.JSX.Element {
  const { appInfo, caps } = useAppStore()
  const [update, setUpdate] = useState<UpdateCheckResult | null>(null)
  const [checking, setChecking] = useState(false)

  const checkUpdate = async (): Promise<void> => {
    setChecking(true)
    try {
      setUpdate(await window.frostbyte.checkUpdate())
    } finally {
      setChecking(false)
    }
  }

  const hwList = [
    caps.nvenc.h264 && 'NVIDIA NVENC',
    caps.qsv.h264 && 'Intel Quick Sync',
    caps.amf.h264 && 'AMD AMF'
  ].filter(Boolean) as string[]

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
        <div className="flex items-center justify-between">
          <Label>Latest release</Label>
          <Button onClick={checkUpdate} disabled={checking}>
            <RefreshCw size={15} className={cn(checking && 'animate-spin')} />
            Check now
          </Button>
        </div>
        {update && (
          <div className="mt-3 text-sm">
            {update.error ? (
              <span className="text-textFaint">{update.error}</span>
            ) : update.updateAvailable ? (
              <button
                onClick={() => update.releaseUrl && window.open(update.releaseUrl)}
                className="no-drag flex items-center gap-2 font-semibold text-frost"
              >
                <Download size={16} />
                Update available: v{update.latestVersion}
              </button>
            ) : (
              <span className="flex items-center gap-2 text-textDim">
                <CheckCircle2 size={16} className="text-frost" />
                You&apos;re on the latest version
              </span>
            )}
          </div>
        )}
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
              <Github size={13} />
              GitHub
            </a>
            <a
              href="https://buymeacoffee.com/dushmantha"
              onClick={(e) => { e.preventDefault(); window.open('https://buymeacoffee.com/dushmantha') }}
              className="no-drag flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400 transition-colors hover:bg-amber-500/20 hover:text-amber-300"
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
