import { Video, Gauge, Wand2, Volume2, FolderOutput, Code2 } from 'lucide-react'
import { Panel, Field, Segmented, Select, Slider, NumberInput, Toggle } from './ui'
import { CommandPreview } from './CommandPreview'
import { useSettingsStore } from '@renderer/store/settingsStore'
import { useAppStore } from '@renderer/store/appStore'

const opt = <T extends string>(...vals: T[]): { label: string; value: T }[] =>
  vals.map((v) => ({ label: v, value: v }))

export function AdvancedPanel(): React.JSX.Element {
  const { settings: s, set } = useSettingsStore()
  const vendor = useAppStore((st) => st.caps.vendorGuess)
  const hwLabel = vendor === 'nvidia' ? 'NVENC' : vendor === 'intel' ? 'Quick Sync' : vendor === 'amd' ? 'AMF' : 'none'

  return (
    <div className="space-y-3">
      <Panel title="Video" icon={<Video size={16} />} defaultOpen>
        <Field label="Output">
          <Segmented
            value={s.videoMode}
            onChange={(v) => set('videoMode', v)}
            options={[
              { label: 'Video + Audio', value: 'encode' },
              { label: 'Audio only', value: 'none' }
            ]}
          />
        </Field>
        {s.videoMode === 'encode' && (
          <>
            <Field label="Codec">
              <Select
                value={s.videoCodec}
                onChange={(v) => set('videoCodec', v)}
                options={[
                  { label: 'H.264 / AVC', value: 'h264' },
                  { label: 'H.265 / HEVC', value: 'hevc' },
                  { label: 'VP9', value: 'vp9' },
                  { label: 'AV1', value: 'av1' },
                  { label: 'Copy (no re-encode)', value: 'copy' }
                ]}
              />
            </Field>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-text">Hardware acceleration</div>
                <div className="text-xs text-textFaint">
                  {hwLabel === 'none' ? 'No GPU encoder detected' : `Use ${hwLabel} for fast encoding`}
                </div>
              </div>
              <Toggle checked={s.preferHardware} onChange={(v) => set('preferHardware', v)} />
            </div>
            <Field label="Container">
              <Segmented value={s.container} onChange={(v) => set('container', v)} options={opt('mp4', 'mkv', 'mov', 'webm')} />
            </Field>
          </>
        )}
        {s.videoMode === 'none' && (
          <div className="text-xs text-textFaint">
            Video is dropped — only the audio track is exported. Set the audio codec below.
          </div>
        )}
      </Panel>

      <Panel title="Rate Control" icon={<Gauge size={16} />}>
        <Field label="Mode">
          <Segmented
            value={s.rateControl}
            onChange={(v) => set('rateControl', v)}
            options={[
              { label: 'Quality', value: 'crf' },
              { label: 'Bitrate', value: 'bitrate' },
              { label: 'Target size', value: 'targetSize' }
            ]}
          />
        </Field>
        {s.rateControl === 'crf' && (
          <Field label="CRF" hint="Lower = better quality & larger file. 18–28 is typical.">
            <Slider value={s.crf} min={0} max={51} onChange={(v) => set('crf', v)} />
          </Field>
        )}
        {s.rateControl === 'bitrate' && (
          <Field label="Video bitrate">
            <NumberInput value={s.videoBitrateKbps} onChange={(v) => set('videoBitrateKbps', v)} suffix="kbps" />
          </Field>
        )}
        {s.rateControl === 'targetSize' && (
          <Field label="Target file size" hint="Two-pass encoding fits the output under this size.">
            <NumberInput value={s.targetSizeMB} onChange={(v) => set('targetSizeMB', v)} suffix="MB" />
          </Field>
        )}
        <Field label="Encoder preset" hint="Slower presets compress better but take longer.">
          <Select
            value={s.preset}
            onChange={(v) => set('preset', v)}
            options={opt('ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium', 'slow', 'slower', 'veryslow')}
          />
        </Field>
      </Panel>

      <Panel title="Filters & Scaling" icon={<Wand2 size={16} />}>
        <Field label="Resolution">
          <Select
            value={s.resolution}
            onChange={(v) => set('resolution', v)}
            options={[
              { label: 'Original', value: 'original' },
              { label: '480p', value: '480p' },
              { label: '720p', value: '720p' },
              { label: '1080p', value: '1080p' },
              { label: '1440p', value: '1440p' },
              { label: '2160p (4K)', value: '2160p' }
            ]}
          />
        </Field>
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-text">Never upscale</div>
          <Toggle checked={s.noUpscale} onChange={(v) => set('noUpscale', v)} />
        </div>
        <Field label="Frame rate">
          <NumberInput value={s.fps ?? 0} onChange={(v) => set('fps', v || null)} suffix="fps · 0 keeps source" />
        </Field>
        <Field label="Denoise">
          <Segmented value={s.denoise} onChange={(v) => set('denoise', v)} options={opt('none', 'light', 'medium', 'strong')} />
        </Field>
      </Panel>

      <Panel title="Audio" icon={<Volume2 size={16} />}>
        <Field label="Mode">
          <Segmented
            value={s.audioMode}
            onChange={(v) => set('audioMode', v)}
            options={[
              { label: 'Encode', value: 'encode' },
              { label: 'Copy', value: 'copy' },
              { label: 'Remove', value: 'none' }
            ]}
          />
        </Field>
        {s.audioMode === 'encode' && (
          <>
            <Field label="Codec">
              <Select value={s.audioCodec} onChange={(v) => set('audioCodec', v)} options={opt('aac', 'opus', 'mp3', 'flac', 'ac3')} />
            </Field>
            <Field label="Audio bitrate">
              <NumberInput value={s.audioBitrateKbps} onChange={(v) => set('audioBitrateKbps', v)} suffix="kbps" />
            </Field>
          </>
        )}
      </Panel>

      <Panel title="Output" icon={<FolderOutput size={16} />}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-text">Faststart (web)</div>
            <div className="text-xs text-textFaint">Move metadata to the front for streaming</div>
          </div>
          <Toggle checked={s.faststart} onChange={(v) => set('faststart', v)} />
        </div>
      </Panel>

      <Panel title="Custom arguments" icon={<Code2 size={16} />}>
        <Field label="Extra arguments" hint="Appended verbatim to the command. Power users only.">
          <textarea
            value={s.extraArgs ?? ''}
            onChange={(e) => set('extraArgs', e.target.value)}
            placeholder="-x264-params keyint=48 ..."
            className="no-drag h-20 w-full resize-none rounded-md bg-panel2 border border-white/10 focus:border-white/25 px-3 py-2 font-mono text-xs text-text outline-none transition-colors"
          />
        </Field>
        <CommandPreview settings={s} />
      </Panel>
    </div>
  )
}
