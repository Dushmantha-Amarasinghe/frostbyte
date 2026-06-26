import { useState, DragEvent } from 'react'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { probeAndAdd, useFilesStore } from '@renderer/store/filesStore'
import { Snowflake } from './Snowflake'

export function DropZone(): React.JSX.Element {
  const [over, setOver] = useState(false)
  const probing = useFilesStore((s) => s.probing)

  const onDrop = async (e: DragEvent): Promise<void> => {
    e.preventDefault()
    setOver(false)
    const paths: string[] = []
    for (const f of Array.from(e.dataTransfer.files)) {
      try {
        paths.push(window.frostbyte.getPathForFile(f))
      } catch {
        /* ignore */
      }
    }
    await probeAndAdd(paths)
  }

  const onPick = async (): Promise<void> => {
    const paths = await window.frostbyte.openFiles()
    await probeAndAdd(paths)
  }

  return (
    <motion.button
      onClick={onPick}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      whileHover={{ scale: 1.004 }}
      whileTap={{ scale: 0.997 }}
      className={cn(
        'no-drag group relative flex w-full flex-col items-center justify-center overflow-hidden rounded-xl py-14 transition-colors',
        over ? 'frost-edge bg-frost/[0.06]' : 'glass hover:border-lineBright'
      )}
    >
      {/* dashed frame */}
      <span
        className={cn(
          'pointer-events-none absolute inset-3 rounded-lg border border-dashed transition-colors',
          over ? 'border-white/40' : 'border-line group-hover:border-white/20'
        )}
      />

      <motion.div animate={{ y: over ? -2 : [0, -4, 0] }} transition={over ? {} : { duration: 5, repeat: Infinity, ease: 'easeInOut' }} className="relative">
        <div
          className={cn(
            'flex h-16 w-16 items-center justify-center rounded-2xl border transition-colors',
            over ? 'border-frost/60 bg-frost/15' : 'border-line bg-white/[0.03]'
          )}
        >
          {probing ? <Loader2 size={28} className="animate-spin text-frost" /> : <Snowflake size={30} glow={over} />}
        </div>
      </motion.div>

      <div className="relative mt-5 font-display text-xl font-semibold tracking-tighter text-text">
        {probing ? 'Reading files…' : over ? 'Release to add' : 'Drop a video to compress'}
      </div>
      <div className="relative mt-1.5 text-sm text-textDim">or click to browse your files</div>
      <div className="relative mt-3 font-mono text-[11px] uppercase tracking-[0.2em] text-textFaint">
        MP4 · MOV · MKV · WEBM · AVI
      </div>
    </motion.button>
  )
}
