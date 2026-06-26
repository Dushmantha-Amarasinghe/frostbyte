import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import {
  Eye,
  Plus,
  FolderOpen,
  Pencil,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  MinusCircle,
  Clock,
  RotateCcw,
  Gauge,
  Pause,
  Play
} from 'lucide-react'
import { Button, Toggle, Panel } from '@renderer/components/ui'
import { WatchFolderModal, FolderDraft } from '@renderer/components/WatchFolderModal'
import { useWatchStore } from '@renderer/store/watchStore'
import { WatchFolderView, WatchFileRecord, OutputConfig } from '@shared/ipc-contract'
import { cn, formatBytes } from '@renderer/lib/utils'

const SCOPE_LABEL: Record<string, string> = {
  existingAndFuture: 'Existing + new',
  existingOnly: 'Existing only',
  futureOnly: 'New only'
}
const TRIGGER_LABEL: Record<string, string> = {
  idle: 'When idle',
  scheduled: 'Quiet hours',
  realtime: 'Immediately'
}

export function Watch(): React.JSX.Element {
  const { views, setViews } = useWatchStore()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<FolderDraft | undefined>(undefined)
  const [outputConfig, setOutputConfig] = useState<OutputConfig | null>(null)
  const [showBgDialog, setShowBgDialog] = useState(false)

  useEffect(() => {
    window.frostbyte.getOutputConfig().then(setOutputConfig)
  }, [])

  const bgMode = outputConfig?.backgroundMode ?? false

  const applyBgMode = (enabled: boolean): void => {
    if (!outputConfig) return
    const next = { ...outputConfig, backgroundMode: enabled }
    setOutputConfig(next)
    window.frostbyte.setOutputConfig(next)
  }

  const handleBgToggle = (): void => {
    if (!outputConfig) return
    if (bgMode) {
      applyBgMode(false)
      return
    }
    const skip = localStorage.getItem('frostbyte-skip-bgmode-dialog') === 'true'
    if (skip) {
      applyBgMode(true)
    } else {
      setShowBgDialog(true)
    }
  }

  const handleBgConfirm = (skipInFuture: boolean): void => {
    if (skipInFuture) localStorage.setItem('frostbyte-skip-bgmode-dialog', 'true')
    setShowBgDialog(false)
    applyBgMode(true)
  }

  const openAdd = (): void => {
    setEditing(undefined)
    setModalOpen(true)
  }

  const openEdit = (v: WatchFolderView): void => {
    const f = v.folder
    setEditing({
      id: f.id,
      path: f.path,
      scope: f.scope,
      mode: f.mode,
      safeDelete: f.safeDelete,
      holdDays: f.holdDays,
      presetId: f.presetId,
      settings: f.settings,
      schedule: f.schedule,
      minSavingsPercent: f.minSavingsPercent
    })
    setModalOpen(true)
  }

  const save = async (draft: FolderDraft): Promise<void> => {
    const next = draft.id
      ? await window.frostbyte.watchUpdate(draft.id, {
          path: draft.path,
          scope: draft.scope,
          mode: draft.mode,
          safeDelete: draft.safeDelete,
          holdDays: draft.holdDays,
          presetId: draft.presetId,
          settings: draft.settings,
          schedule: draft.schedule,
          minSavingsPercent: draft.minSavingsPercent
        })
      : await window.frostbyte.watchAdd(draft)
    setViews(next)
    setModalOpen(false)
  }

  const toggle = async (id: string, enabled: boolean): Promise<void> =>
    setViews(await window.frostbyte.watchToggle(id, enabled))
  const remove = async (id: string): Promise<void> =>
    setViews(await window.frostbyte.watchRemove(id))

  return (
    <div className="mx-auto max-w-3xl px-10 py-9">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 font-display text-2xl font-semibold tracking-tight text-text">
            <Eye size={22} className="text-frost" />
            Watch Folders
          </h1>
          <p className="mt-1 text-sm text-textDim">
            Frostbyte quietly compresses new videos in these folders.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            disabled={!outputConfig}
            onClick={handleBgToggle}
            className={cn(
              'no-drag flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40',
              bgMode
                ? 'border-frost/30 bg-frost/10 text-frost hover:bg-frost/15'
                : 'border-white/10 bg-white/[0.04] text-textDim hover:border-white/20 hover:bg-white/[0.07] hover:text-text'
            )}
          >
            <Gauge size={13} />
            Background mode
          </button>
          {views.length > 0 && (
            <Button variant="primary" onClick={openAdd}>
              <Plus size={16} />
              Add folder
            </Button>
          )}
        </div>
      </div>

      {views.length === 0 ? (
        <EmptyState onAdd={openAdd} />
      ) : (
        <div className="space-y-4">
          {views.map((v) => (
            <FolderCard key={v.folder.id} view={v} onToggle={toggle} onEdit={openEdit} onRemove={remove} />
          ))}
        </div>
      )}

      <WatchFolderModal open={modalOpen} initial={editing} onClose={() => setModalOpen(false)} onSave={save} />

      {showBgDialog && (
        <BackgroundModeDialog
          onCancel={() => setShowBgDialog(false)}
          onConfirm={handleBgConfirm}
        />
      )}
    </div>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }): React.JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center rounded-xl glass px-8 py-16 text-center"
    >
      <div className="rounded-full bg-white/[0.04] p-4">
        <FolderOpen size={32} className="text-frost" />
      </div>
      <h2 className="mt-5 font-display text-lg font-semibold tracking-tight text-text">
        Watch your first folder
      </h2>
      <p className="mt-2 max-w-sm text-sm text-textDim">
        Pick a folder like your screen recordings or downloads. New videos get compressed
        automatically — originals are kept safe.
      </p>
      <div className="mt-6">
        <Button variant="primary" onClick={onAdd}>
          <Plus size={16} />
          Add a folder
        </Button>
      </div>
    </motion.div>
  )
}

function FolderCard({
  view,
  onToggle,
  onEdit,
  onRemove
}: {
  view: WatchFolderView
  onToggle: (id: string, enabled: boolean) => void
  onEdit: (v: WatchFolderView) => void
  onRemove: (id: string) => void
}): React.JSX.Element {
  const { folder, files, stats } = view
  const activity = useWatchStore((s) => s.activity)
  const live = activity && activity.folderId === folder.id ? activity : null
  const folderName = folder.path.split(/[/\\]/).filter(Boolean).pop() ?? folder.path

  return (
    <div className="overflow-hidden rounded-xl glass">
      <div className="flex items-start justify-between gap-4 px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FolderOpen size={16} className="shrink-0 text-frost" />
            <span className="truncate font-display text-base font-semibold tracking-tight text-text">
              {folderName}
            </span>
          </div>
          <div className="mt-0.5 truncate font-mono text-[11px] text-textFaint">{folder.path}</div>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <Badge>{SCOPE_LABEL[folder.scope]}</Badge>
            <Badge>{folder.mode === 'replace' ? 'Replace' : 'Keep both'}</Badge>
            <Badge>
              <Clock size={10} /> {TRIGGER_LABEL[folder.schedule.trigger]}
            </Badge>
            {stats.totalSavedBytes > 0 && <Badge accent>Saved {formatBytes(stats.totalSavedBytes)}</Badge>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Toggle checked={folder.enabled} onChange={(v) => onToggle(folder.id, v)} />
          <button onClick={() => onEdit(view)} className="no-drag rounded-md p-2 text-textDim hover:bg-white/5 hover:text-text" title="Edit">
            <Pencil size={15} />
          </button>
          <button onClick={() => onRemove(folder.id)} className="no-drag rounded-md p-2 text-textDim hover:bg-dangerBg hover:text-danger" title="Stop watching">
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Live activity */}
      {live && (
        <div className="flex items-center gap-2.5 border-t border-line bg-white/[0.02] px-5 py-2.5">
          {live.waitingReason ? (
            <>
              <Clock size={14} className="text-textDim" />
              <span className="text-xs text-textDim">{live.waitingReason}</span>
            </>
          ) : (
            <>
              {live.paused
                ? <Pause size={14} className="shrink-0 text-textDim" />
                : <Loader2 size={14} className="shrink-0 animate-spin text-frost" />
              }
              <span className="flex-1 truncate text-xs text-text">
                {live.paused ? 'Paused · ' : 'Compressing '}
                {live.name}
                {live.progress ? ` · ${Math.round(live.progress.percent)}%` : ''}
              </span>
              <button
                onClick={() => live.paused ? window.frostbyte.watchResume() : window.frostbyte.watchPause()}
                className="no-drag shrink-0 rounded p-1 text-textDim transition-colors hover:bg-white/5 hover:text-text"
                title={live.paused ? 'Resume encoding' : 'Pause encoding'}
              >
                {live.paused ? <Play size={12} /> : <Pause size={12} />}
              </button>
            </>
          )}
        </div>
      )}

      {/* Stat strip + file disclosure */}
      <div className="border-t border-line px-2 py-2">
        <Panel
          defaultOpen
          title={`${stats.done} done · ${stats.queued} queued · ${stats.skipped} skipped${stats.error ? ` · ${stats.error} errors` : ''}`}
        >
          {files.length === 0 ? (
            <div className="text-xs text-textFaint">No files tracked yet.</div>
          ) : (
            <div className="space-y-1">
              {files.slice(0, 50).map((f) => (
                <FileRow key={f.fingerprint} file={f} />
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}

function FileRow({ file }: { file: WatchFileRecord }): React.JSX.Element {
  const rowRef = useRef<HTMLDivElement>(null)
  const [tipRect, setTipRect] = useState<{ x: number; y: number; above: boolean } | null>(null)
  const hasReason = (file.status === 'error' || file.status === 'skipped') && !!file.reason

  const showTip = (): void => {
    if (!hasReason || !rowRef.current) return
    const r = rowRef.current.getBoundingClientRect()
    // Show above if less than 80px below the row, otherwise show below
    const above = window.innerHeight - r.bottom < 80
    setTipRect({ x: r.left, y: above ? r.top : r.bottom, above })
  }

  const retry = (): void => {
    window.frostbyte.watchRetryFile(file.fingerprint).then(useWatchStore.getState().setViews)
  }

  return (
    <>
      <div
        ref={rowRef}
        className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-white/[0.02]"
        onMouseEnter={showTip}
        onMouseLeave={() => setTipRect(null)}
      >
        <StatusIcon status={file.status} />
        <span className="min-w-0 flex-1 truncate text-xs text-textDim">{file.name}</span>
        {file.status === 'done' && file.savedPercent != null && (
          <span className="font-mono text-[11px] text-frost">−{file.savedPercent}%</span>
        )}
        {(file.status === 'skipped' || file.status === 'error') && (
          <button onClick={retry} className="no-drag rounded p-1 text-textFaint hover:text-text" title="Retry">
            <RotateCcw size={12} />
          </button>
        )}
      </div>
      {tipRect && file.reason && createPortal(
        <div
          className="pointer-events-none fixed z-[9999] max-w-[300px] rounded-lg border border-white/10 bg-[#16181d] px-3 py-2 shadow-xl"
          style={{
            left: tipRect.x,
            ...(tipRect.above
              ? { bottom: window.innerHeight - tipRect.y + 6 }
              : { top: tipRect.y + 6 })
          }}
        >
          {tipRect.above && (
            <span className="absolute -bottom-1.5 left-4 h-2.5 w-2.5 rotate-45 border-b border-r border-white/10 bg-[#16181d]" />
          )}
          <p className="text-[11px] leading-snug text-textDim">{file.reason}</p>
          {!tipRect.above && (
            <span className="absolute -top-1.5 left-4 h-2.5 w-2.5 rotate-45 border-l border-t border-white/10 bg-[#16181d]" />
          )}
        </div>,
        document.body
      )}
    </>
  )
}

function StatusIcon({ status }: { status: WatchFileRecord['status'] }): React.JSX.Element {
  switch (status) {
    case 'processing':
      return <Loader2 size={13} className="shrink-0 animate-spin text-frost" />
    case 'done':
      return <CheckCircle2 size={13} className="shrink-0 text-frost" />
    case 'error':
      return <AlertCircle size={13} className="shrink-0 text-danger" />
    case 'queued':
      return <Clock size={13} className="shrink-0 text-textDim" />
    default:
      return <MinusCircle size={13} className="shrink-0 text-textFaint" />
  }
}

function BackgroundModeDialog({
  onCancel,
  onConfirm
}: {
  onCancel: () => void
  onConfirm: (skipInFuture: boolean) => void
}): React.JSX.Element {
  const [skip, setSkip] = useState(false)

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-[360px] rounded-2xl border border-white/10 bg-[#16181d] p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-frost/10">
            <Gauge size={20} className="text-frost" />
          </div>
          <h3 className="font-display text-base font-semibold tracking-tight text-text">
            Enable Background Mode
          </h3>
        </div>
        <p className="text-sm leading-relaxed text-textDim">
          Frostbyte will lower its encoding priority so your GPU and CPU stay free for games and other demanding apps.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-textDim">
          Encodes will still complete — just at a slower pace.
        </p>
        <label className="mt-4 flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={skip}
            onChange={(e) => setSkip(e.target.checked)}
            className="h-3.5 w-3.5 accent-[#38bdf8]"
          />
          <span className="text-xs text-textFaint">Don't show this again</span>
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="no-drag rounded-lg px-4 py-2 text-sm text-textDim transition-colors hover:bg-white/5 hover:text-text"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(skip)}
            className="no-drag rounded-lg bg-frost px-4 py-2 text-sm font-medium text-[#0f0f0f] transition-colors hover:bg-frost/90"
          >
            Enable
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function Badge({ children, accent }: { children: React.ReactNode; accent?: boolean }): React.JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
        accent ? 'bg-frost/10 text-frost ring-1 ring-inset ring-frost/20' : 'bg-white/[0.05] text-textDim'
      )}
    >
      {children}
    </span>
  )
}
