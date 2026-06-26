import { useState } from 'react'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { SlidersHorizontal, ChevronDown, ArrowRight } from 'lucide-react'
import { DropZone } from '@renderer/components/DropZone'
import { FileList } from '@renderer/components/FileList'
import { PresetCard } from '@renderer/components/PresetCard'
import { AdvancedPanel } from '@renderer/components/AdvancedPanel'
import { Snowflake } from '@renderer/components/Snowflake'
import { SIMPLE_PRESETS } from '@shared/presets'
import { useSettingsStore } from '@renderer/store/settingsStore'
import { useFilesStore } from '@renderer/store/filesStore'
import { useCompress } from '@renderer/lib/useCompress'
import { cn } from '@renderer/lib/utils'

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } }
}
const rise: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } }
}

export function Simple(): React.JSX.Element {
  const activePresetId = useSettingsStore((s) => s.activePresetId)
  const applyPreset = useSettingsStore((s) => s.applyPreset)
  const fileCount = useFilesStore((s) => s.files.length)
  const { compress, canCompress } = useCompress()
  const [advancedOpen, setAdvancedOpen] = useState(false)

  return (
    <div className="relative flex h-full flex-col">
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="flex-1 overflow-y-auto px-10 pb-32 pt-9"
      >
        <div className="mx-auto max-w-3xl">
          {/* Header */}
          <motion.header variants={rise} className="mb-6">
            <h1 className="font-display text-2xl font-bold tracking-tight text-text">Compress</h1>
            <p className="mt-1 text-sm text-textDim">
              Add a video, choose a preset, and export a smaller file.
            </p>
          </motion.header>

          <motion.div variants={rise}>
            <DropZone />
          </motion.div>

          <motion.div variants={rise} className="mt-4">
            <FileList />
          </motion.div>

          {/* Presets */}
          <motion.div variants={rise} className="mb-3 mt-9 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold tracking-tight text-text">Presets</h2>
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-textFaint">
              Tap one, then compress
            </span>
          </motion.div>

          <motion.div variants={rise} className="grid grid-cols-3 gap-3">
            {SIMPLE_PRESETS.map((p) => (
              <PresetCard key={p.id} preset={p} selected={activePresetId === p.id} onSelect={applyPreset} />
            ))}
          </motion.div>

          {/* Advanced disclosure (folded under presets) */}
          <motion.div variants={rise} className="mt-4">
            <button
              onClick={() => setAdvancedOpen((v) => !v)}
              className="no-drag flex w-full items-center justify-between rounded-lg glass px-4 py-3.5 transition-colors hover:border-lineBright"
            >
              <div className="flex items-center gap-2.5">
                <SlidersHorizontal size={16} className="text-frost" />
                <span className="font-display text-sm font-semibold tracking-tight text-text">
                  Advanced settings
                </span>
                <span className="font-mono text-[11px] text-textFaint">fine-tune every setting</span>
              </div>
              <ChevronDown size={18} className={cn('text-textFaint transition-transform', advancedOpen && 'rotate-180')} />
            </button>
            <AnimatePresence initial={false}>
              {advancedOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                  className="overflow-hidden"
                >
                  <div className="pt-3">
                    <AdvancedPanel />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </motion.div>

      {/* Compress dock */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-ink via-ink/95 to-transparent px-10 pb-6 pt-8">
        <div className="mx-auto max-w-3xl">
          <button
            onClick={compress}
            disabled={!canCompress}
            className={cn(
              'no-drag group relative flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-lg py-4 text-[15px] font-semibold transition-all',
              canCompress
                ? 'pointer-events-auto border border-line bg-panel2 text-text hover:bg-[#26262a] hover:border-lineBright'
                : 'pointer-events-auto border border-dashed border-line text-textFaint hover:border-lineBright hover:text-textDim'
            )}
          >
            {canCompress ? (
              <>
                <Snowflake size={18} />
                Compress {fileCount} {fileCount === 1 ? 'file' : 'files'}
                <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />
              </>
            ) : (
              <>Add a video to get started</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
