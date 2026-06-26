import { useState } from 'react'
import { motion } from 'framer-motion'
import { FolderOpen, RefreshCw, CheckCircle2, Download, Cpu } from 'lucide-react'
import { Snowflake } from '@renderer/components/Snowflake'
import { Button, Field, Label } from '@renderer/components/ui'
import { useAppStore } from '@renderer/store/appStore'
import { UpdateCheckResult } from '@shared/ipc-contract'
import { cn } from '@renderer/lib/utils'

export function About(): React.JSX.Element {
  const { appInfo, caps, outputConfig, setOutputConfig } = useAppStore()
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

  const pickFolder = async (): Promise<void> => {
    const folder = await window.frostbyte.chooseOutputDir()
    if (folder) {
      const next = { ...outputConfig, folder }
      setOutputConfig(next)
      window.frostbyte.setOutputConfig(next)
    }
  }

  const setSameFolder = (): void => {
    const next = { ...outputConfig, folder: null }
    setOutputConfig(next)
    window.frostbyte.setOutputConfig(next)
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

      <Section title="Output">
        <Field label="Destination folder">
          <div className="flex items-center gap-2">
            <div className="flex-1 truncate rounded-md bg-black/30 px-3 py-2 font-mono text-xs text-textDim hairline">
              {outputConfig.folder ?? 'Same folder as each source'}
            </div>
            <Button onClick={pickFolder}>
              <FolderOpen size={15} />
              Choose
            </Button>
            {outputConfig.folder && (
              <Button variant="ghost" onClick={setSameFolder}>
                Reset
              </Button>
            )}
          </div>
        </Field>
        <div className="mt-4">
          <Field label="Filename template" hint="Tokens: {name} {date} {codec} {res} {preset}">
            <input
              value={outputConfig.template}
              onChange={(e) => {
                const next = { ...outputConfig, template: e.target.value }
                setOutputConfig(next)
                window.frostbyte.setOutputConfig(next)
              }}
              className="no-drag w-full rounded-md bg-black/30 px-3 py-2 font-mono text-sm text-text outline-none hairline focus:border-lineBright"
            />
          </Field>
        </div>
      </Section>

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
