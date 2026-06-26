import { motion } from 'framer-motion'
import { Gauge, Zap, MessageCircle, Monitor, Globe, Film, Music } from 'lucide-react'
import { SimplePreset } from '@shared/presets'
import { cn } from '@renderer/lib/utils'
import { Snowflake } from './Snowflake'

const ICONS = {
  snowflake: null,
  gauge: Gauge,
  bolt: Zap,
  message: MessageCircle,
  monitor: Monitor,
  globe: Globe,
  film: Film,
  music: Music
}

function resLabel(preset: SimplePreset): string {
  const r = preset.settings.resolution
  if (preset.settings.videoMode === 'none' || preset.id === 'audiomp3') return 'Audio'
  if (preset.settings.videoCodec === 'copy') return 'Original'
  if (!r || r === 'original') return 'Source size'
  return `≤ ${r}`
}

export function PresetCard({
  preset,
  selected,
  onSelect
}: {
  preset: SimplePreset
  selected: boolean
  onSelect: (id: string) => void
}): React.JSX.Element {
  const Icon = ICONS[preset.icon]
  return (
    <motion.button
      onClick={() => onSelect(preset.id)}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: 'spring', stiffness: 400, damping: 26 }}
      className={cn(
        'no-drag relative flex flex-col items-start overflow-hidden rounded-lg p-4 text-left transition-colors',
        selected ? 'frost-edge bg-frost/[0.07]' : 'glass hover:border-lineBright'
      )}
    >
      {selected && (
        <motion.span
          layoutId="preset-active-glow"
          className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-frost/25 blur-2xl"
        />
      )}
      <div className="flex w-full items-start justify-between">
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-md border transition-colors',
            selected ? 'border-frost/50 bg-frost/15' : 'border-line bg-white/[0.03]'
          )}
        >
          {preset.icon === 'snowflake' || !Icon ? (
            <Snowflake size={20} glow={selected} />
          ) : (
            <Icon size={19} className={selected ? 'text-frost' : 'text-text'} />
          )}
        </div>
        <span
          className={cn(
            'rounded font-mono text-[10px] uppercase tracking-wide',
            'px-1.5 py-1',
            selected ? 'bg-frost/15 text-frost' : 'bg-white/[0.04] text-textFaint'
          )}
        >
          {resLabel(preset)}
        </span>
      </div>
      <div className={cn('mt-3 font-display text-[15px] font-semibold tracking-tight', selected ? 'text-frost' : 'text-text')}>
        {preset.name}
      </div>
      <div className="mt-0.5 text-xs text-textDim">{preset.description}</div>
    </motion.button>
  )
}
