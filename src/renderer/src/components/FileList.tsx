import { motion, AnimatePresence } from 'framer-motion'
import { Film, X } from 'lucide-react'
import { useFilesStore } from '@renderer/store/filesStore'
import { formatBytes, formatDuration } from '@renderer/lib/utils'

export function FileList(): React.JSX.Element | null {
  const files = useFilesStore((s) => s.files)
  const remove = useFilesStore((s) => s.remove)
  if (!files.length) return null

  return (
    <div className="space-y-2">
      <AnimatePresence initial={false}>
        {files.map((f) => (
          <motion.div
            key={f.path}
            layout
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-3 rounded-lg glass p-3"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-line bg-white/[0.03]">
              <Film size={17} className="text-frost" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-text">{f.name}</div>
              <div className="tnum font-mono text-[11px] text-textFaint">
                {f.width}×{f.height} · {formatDuration(f.durationSec)} · {formatBytes(f.sizeBytes)}
                {f.vcodec !== 'unknown' && ` · ${f.vcodec.toUpperCase()}`}
              </div>
            </div>
            <button
              onClick={() => remove(f.path)}
              className="no-drag flex h-7 w-7 items-center justify-center rounded-md text-textFaint transition-colors hover:bg-white/5 hover:text-danger"
            >
              <X size={16} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
