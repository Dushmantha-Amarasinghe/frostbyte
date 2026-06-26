import { motion, AnimatePresence } from 'framer-motion'
import { X, FolderOpen, CheckCircle2, AlertCircle, Loader2, Snowflake as SnowIcon } from 'lucide-react'
import { ProgressBar } from '@renderer/components/ProgressBar'
import { Button } from '@renderer/components/ui'
import { useQueueStore } from '@renderer/store/queueStore'
import { QueueItem } from '@shared/ipc-contract'
import { formatBytes, formatDuration, cn } from '@renderer/lib/utils'

export function Queue(): React.JSX.Element {
  const items = useQueueStore((s) => s.items)
  const active = items.some((i) => i.status === 'running' || i.status === 'queued')

  return (
    <div className="mx-auto max-w-3xl px-10 py-9">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-frostDim">Pipeline</div>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-text">Queue</h1>
        </div>
        {active && (
          <Button variant="danger" onClick={() => window.frostbyte.queueCancelAll()}>
            Cancel all
          </Button>
        )}
      </header>

      {items.length === 0 ? (
        <div className="mt-24 flex flex-col items-center text-center">
          <div className="opacity-40">
            <SnowIcon size={40} className="text-frostDim" />
          </div>
          <div className="mt-4 font-display text-lg font-semibold text-text">Nothing queued yet</div>
          <div className="mt-1 text-sm text-textFaint">Pick a preset on the Compress tab and go.</div>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {items.map((it) => (
              <motion.div
                key={it.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
              >
                <Row item={it} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

function Row({ item }: { item: QueueItem }): React.JSX.Element {
  const p = item.progress
  const running = item.status === 'running'
  const done = item.status === 'done'

  return (
    <div className={cn('rounded-lg p-4 transition-colors', running ? 'frost-edge bg-frost/[0.04]' : 'glass')}>
      <div className="flex items-center gap-3">
        <StatusIcon status={item.status} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-text">{item.info.name}</div>
          <div className="font-mono text-[11px] text-textFaint">
            {item.info.width}×{item.info.height} · {formatDuration(item.info.durationSec)} · {formatBytes(item.info.sizeBytes)}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {done && (
            <IconBtn title="Show in folder" onClick={() => window.frostbyte.revealFile(item.outputPath)} hover="frost">
              <FolderOpen size={16} />
            </IconBtn>
          )}
          {(item.status === 'queued' || running) && (
            <IconBtn title="Cancel" onClick={() => window.frostbyte.queueCancelItem(item.id)} hover="danger">
              <X size={16} />
            </IconBtn>
          )}
          {!running && (
            <IconBtn title="Remove" onClick={() => window.frostbyte.queueRemove(item.id)}>
              <X size={16} />
            </IconBtn>
          )}
        </div>
      </div>

      {running && p && (
        <div className="mt-3.5">
          <ProgressBar percent={p.percent} />
          <div className="tnum mt-2 flex items-center justify-between font-mono text-[11px] text-textDim">
            <span className="text-sm font-bold text-frost">{p.percent.toFixed(0)}%</span>
            <span>
              {p.fps.toFixed(0)} fps · {p.speed.toFixed(2)}× speed{p.pass ? ` · pass ${p.pass}` : ''}
            </span>
            <span>{p.etaSec != null ? `${formatDuration(p.etaSec)} left` : '…'}</span>
          </div>
        </div>
      )}

      {done && item.result && (
        <div className="mt-3 flex items-center gap-2 font-mono text-[11px]">
          <span className="text-textFaint">{formatBytes(item.result.inputSizeBytes)}</span>
          <span className="text-frost">→</span>
          <span className="text-sm font-bold text-text">{formatBytes(item.result.outputSizeBytes)}</span>
          <span
            className={cn(
              'ml-1 rounded px-2 py-0.5 font-bold',
              item.result.savedPercent > 0 ? 'bg-frost/15 text-frost' : 'bg-white/5 text-textFaint'
            )}
          >
            {item.result.savedPercent > 0 ? `−${item.result.savedPercent}%` : 'larger'}
          </span>
          <span className="ml-auto text-textFaint">{formatDuration(item.result.elapsedSec)}</span>
        </div>
      )}

      {item.status === 'error' && (
        <div className="mt-2 truncate text-xs text-danger" title={item.error ?? ''}>
          {item.error}
        </div>
      )}
    </div>
  )
}

function IconBtn({
  children,
  onClick,
  title,
  hover = 'text'
}: {
  children: React.ReactNode
  onClick: () => void
  title: string
  hover?: 'text' | 'frost' | 'danger'
}): React.JSX.Element {
  const h = hover === 'frost' ? 'hover:text-frost' : hover === 'danger' ? 'hover:text-danger' : 'hover:text-text'
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn('no-drag flex h-8 w-8 items-center justify-center rounded-md text-textFaint transition-colors hover:bg-white/5', h)}
    >
      {children}
    </button>
  )
}

function StatusIcon({ status }: { status: QueueItem['status'] }): React.JSX.Element {
  const base = 'flex h-10 w-10 shrink-0 items-center justify-center rounded-md'
  if (status === 'running')
    return (
      <div className={cn(base, 'bg-frost/15')}>
        <Loader2 size={18} className="animate-spin text-frost" />
      </div>
    )
  if (status === 'done')
    return (
      <div className={cn(base, 'bg-frost/15')}>
        <CheckCircle2 size={18} className="text-frost" />
      </div>
    )
  if (status === 'error')
    return (
      <div className={cn(base, 'bg-dangerBg')}>
        <AlertCircle size={18} className="text-danger" />
      </div>
    )
  return (
    <div className={cn(base, 'border border-line bg-white/[0.03]')}>
      <span className="font-mono text-[11px] text-textFaint">·</span>
    </div>
  )
}
