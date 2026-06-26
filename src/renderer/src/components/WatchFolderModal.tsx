import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { FolderOpen, X, Sliders } from 'lucide-react'
import { Button, Field, Segmented, Select, Slider, NumberInput, Label } from './ui'
import { CompressionSettings, DEFAULT_SETTINGS } from '@shared/settings'
import { SIMPLE_PRESETS } from '@shared/presets'
import {
  WatchFolder,
  WatchScope,
  WatchMode,
  SafeDelete,
  TriggerMode,
  DEFAULT_WATCH_SCHEDULE
} from '@shared/watch'

const opt = <T extends string>(...vals: [T, string][]): { value: T; label: string }[] =>
  vals.map(([value, label]) => ({ value, label }))

function settingsFromPreset(presetId: string | null): CompressionSettings {
  const preset = SIMPLE_PRESETS.find((p) => p.id === presetId)
  return { ...DEFAULT_SETTINGS, ...(preset?.settings ?? {}) }
}

export interface FolderDraft {
  id?: string
  path: string
  scope: WatchScope
  mode: WatchMode
  safeDelete: SafeDelete
  holdDays: number
  presetId: string | null
  settings: CompressionSettings
  schedule: WatchFolder['schedule']
  minSavingsPercent: number
}

const NEW_DRAFT: FolderDraft = {
  path: '',
  scope: 'existingAndFuture',
  mode: 'replace',
  safeDelete: 'recycle',
  holdDays: 14,
  presetId: 'balanced',
  settings: settingsFromPreset('balanced'),
  schedule: DEFAULT_WATCH_SCHEDULE,
  minSavingsPercent: 15
}

export function WatchFolderModal({
  open,
  initial,
  onClose,
  onSave
}: {
  open: boolean
  initial?: FolderDraft
  onClose: () => void
  onSave: (draft: FolderDraft) => void
}): React.JSX.Element | null {
  const [draft, setDraft] = useState<FolderDraft>(initial ?? NEW_DRAFT)
  const [advanced, setAdvanced] = useState(false)

  useEffect(() => {
    if (open) {
      setDraft(initial ?? NEW_DRAFT)
      setAdvanced(initial ? initial.presetId === null : false)
    }
  }, [open, initial])

  const upd = <K extends keyof FolderDraft>(k: K, v: FolderDraft[K]): void =>
    setDraft((d) => ({ ...d, [k]: v }))
  const updSettings = <K extends keyof CompressionSettings>(k: K, v: CompressionSettings[K]): void =>
    setDraft((d) => ({ ...d, settings: { ...d.settings, [k]: v } }))
  const updSchedule = (patch: Partial<WatchFolder['schedule']>): void =>
    setDraft((d) => ({ ...d, schedule: { ...d.schedule, ...patch } }))

  const pickFolder = async (): Promise<void> => {
    const p = await window.frostbyte.watchChooseFolder()
    if (p) upd('path', p)
  }

  const choosePreset = (presetId: string): void =>
    setDraft((d) => ({ ...d, presetId, settings: settingsFromPreset(presetId) }))

  const enableAdvanced = (on: boolean): void => {
    setAdvanced(on)
    // null presetId signals "custom settings" to the backend.
    setDraft((d) => ({ ...d, presetId: on ? null : 'balanced', settings: on ? d.settings : settingsFromPreset('balanced') }))
  }

  const canSave = draft.path.trim().length > 0

  if (!open) return null

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[200] flex items-center justify-center p-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          className="relative z-10 flex max-h-[86vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-line bg-panel shadow-lift"
        >
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="font-display text-lg font-semibold tracking-tight text-text">
              {initial ? 'Edit watched folder' : 'Watch a folder'}
            </h2>
            <button onClick={onClose} className="no-drag text-textFaint hover:text-text">
              <X size={18} />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
            {/* Folder */}
            <Field label="Folder">
              <div className="flex items-center gap-2">
                <div className="flex-1 truncate rounded-md bg-black/30 px-3 py-2 font-mono text-xs text-textDim hairline">
                  {draft.path || 'No folder selected'}
                </div>
                <Button onClick={pickFolder}>
                  <FolderOpen size={15} />
                  Choose
                </Button>
              </div>
            </Field>

            {/* Scope */}
            <Field label="What to compress" hint={scopeHint(draft.scope)}>
              <Segmented
                value={draft.scope}
                onChange={(v) => upd('scope', v)}
                options={opt<WatchScope>(
                  ['existingAndFuture', 'Existing + new'],
                  ['existingOnly', 'Existing only'],
                  ['futureOnly', 'New only']
                )}
              />
            </Field>

            {/* Mode + safe delete */}
            <Field label="After compressing" hint={draft.mode === 'replace' ? 'The original is replaced by the smaller file.' : 'Both the original and compressed file are kept.'}>
              <Segmented
                value={draft.mode}
                onChange={(v) => upd('mode', v)}
                options={opt<WatchMode>(['replace', 'Replace original'], ['keep', 'Keep both'])}
              />
            </Field>
            {draft.mode === 'replace' && (
              <Field label="Original safety" hint={draft.safeDelete === 'recycle' ? 'Originals go to the Recycle Bin — you decide when to clear them.' : `Originals are held in .frostbyte_originals and auto-purged after ${draft.holdDays} days.`}>
                <Segmented
                  value={draft.safeDelete}
                  onChange={(v) => upd('safeDelete', v)}
                  options={opt<SafeDelete>(['recycle', 'Recycle Bin'], ['hold', 'Hold N days'])}
                />
                {draft.safeDelete === 'hold' && (
                  <div className="mt-2">
                    <NumberInput value={draft.holdDays} onChange={(v) => upd('holdDays', v)} suffix="days" />
                  </div>
                )}
              </Field>
            )}

            {/* Compression profile */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Compression</Label>
                <button
                  onClick={() => enableAdvanced(!advanced)}
                  className="no-drag flex items-center gap-1.5 text-[11px] font-medium text-frost hover:text-frost/80"
                >
                  <Sliders size={12} />
                  {advanced ? 'Use a preset' : 'Advanced settings'}
                </button>
              </div>
              {!advanced ? (
                <Select
                  value={draft.presetId ?? 'balanced'}
                  onChange={choosePreset}
                  options={SIMPLE_PRESETS.map((p) => ({ value: p.id, label: `${p.name} — ${p.description}` }))}
                />
              ) : (
                <AdvancedFields settings={draft.settings} set={updSettings} />
              )}
            </div>

            {/* Trigger */}
            <Field label="When to process" hint={triggerHint(draft.schedule.trigger)}>
              <Segmented
                value={draft.schedule.trigger}
                onChange={(v) => updSchedule({ trigger: v as TriggerMode })}
                options={opt<TriggerMode>(
                  ['idle', 'When idle'],
                  ['scheduled', 'Quiet hours'],
                  ['realtime', 'Immediately']
                )}
              />
            </Field>
            {draft.schedule.trigger === 'scheduled' && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="From">
                  <TimeInput value={draft.schedule.quietStart ?? '01:00'} onChange={(v) => updSchedule({ quietStart: v })} />
                </Field>
                <Field label="To">
                  <TimeInput value={draft.schedule.quietEnd ?? '07:00'} onChange={(v) => updSchedule({ quietEnd: v })} />
                </Field>
              </div>
            )}
            {draft.schedule.trigger === 'idle' && (
              <Field label="Idle threshold" hint="Process only after this much inactivity, while on AC power.">
                <NumberInput value={draft.schedule.idleMinutes ?? 5} onChange={(v) => updSchedule({ idleMinutes: v })} suffix="min" />
              </Field>
            )}

            {/* Min savings */}
            <Field label="Skip if savings below" hint="Avoids re-compressing files that are already efficient.">
              <Slider value={draft.minSavingsPercent} min={0} max={50} onChange={(v) => upd('minSavingsPercent', v)} badge={`${draft.minSavingsPercent}%`} />
            </Field>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-4">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" disabled={!canSave} onClick={() => onSave(draft)}>
              {initial ? 'Save changes' : 'Start watching'}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}

/** Compact subset of compression controls for the watch profile. */
function AdvancedFields({
  settings: s,
  set
}: {
  settings: CompressionSettings
  set: <K extends keyof CompressionSettings>(k: K, v: CompressionSettings[K]) => void
}): React.JSX.Element {
  return (
    <div className="space-y-3 rounded-lg glass p-3.5">
      <Field label="Codec">
        <Select
          value={s.videoCodec}
          onChange={(v) => set('videoCodec', v)}
          options={[
            { label: 'H.264 / AVC', value: 'h264' },
            { label: 'H.265 / HEVC', value: 'hevc' },
            { label: 'AV1', value: 'av1' },
            { label: 'VP9', value: 'vp9' }
          ]}
        />
      </Field>
      <Field label="Container">
        <Segmented value={s.container} onChange={(v) => set('container', v)} options={[
          { label: 'mp4', value: 'mp4' },
          { label: 'mkv', value: 'mkv' },
          { label: 'mov', value: 'mov' },
          { label: 'webm', value: 'webm' }
        ]} />
      </Field>
      <Field label="Quality (CRF)" hint="Lower = better quality, larger file.">
        <Slider value={s.crf} min={0} max={51} onChange={(v) => set('crf', v)} />
      </Field>
      <Field label="Resolution">
        <Select
          value={s.resolution}
          onChange={(v) => set('resolution', v)}
          options={[
            { label: 'Original', value: 'original' },
            { label: '720p', value: '720p' },
            { label: '1080p', value: '1080p' },
            { label: '1440p', value: '1440p' },
            { label: '2160p (4K)', value: '2160p' }
          ]}
        />
      </Field>
      <Field label="Encoder preset">
        <Select
          value={s.preset}
          onChange={(v) => set('preset', v)}
          options={['veryfast', 'faster', 'fast', 'medium', 'slow', 'slower'].map((v) => ({ label: v, value: v }))}
        />
      </Field>
    </div>
  )
}

function TimeInput({ value, onChange }: { value: string; onChange: (v: string) => void }): React.JSX.Element {
  return (
    <input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="no-drag w-full rounded-md bg-panel2 border border-white/10 focus:border-white/25 px-3 py-2 font-mono text-sm text-text outline-none transition-colors"
    />
  )
}

function scopeHint(scope: WatchScope): string {
  switch (scope) {
    case 'existingAndFuture':
      return 'Compress everything already here, and anything added later.'
    case 'existingOnly':
      return 'Compress only what is here now; stop watching afterward.'
    case 'futureOnly':
      return 'Ignore current files; only compress new arrivals.'
  }
}

function triggerHint(t: TriggerMode): string {
  switch (t) {
    case 'idle':
      return 'Recommended — runs only when you’re away and on AC power.'
    case 'scheduled':
      return 'Runs only during a quiet-hours window.'
    case 'realtime':
      return 'Compresses as soon as files are stable. May affect performance.'
  }
}
