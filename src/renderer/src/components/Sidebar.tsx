import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sparkles, ListVideo, Eye, Settings2, Info, Cpu } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useQueueStore } from '@renderer/store/queueStore'
import { useWatchStore } from '@renderer/store/watchStore'
import { useAppStore } from '@renderer/store/appStore'

const NAV = [
  { to: '/', label: 'Compress', icon: Sparkles, end: true },
  { to: '/queue', label: 'Queue', icon: ListVideo },
  { to: '/watch', label: 'Watch', icon: Eye },
  { to: '/settings', label: 'Settings', icon: Settings2 },
  { to: '/about', label: 'About', icon: Info }
]

export function Sidebar(): React.JSX.Element {
  const activeJobs = useQueueStore((s) =>
    s.items.filter((i) => i.status === 'queued' || i.status === 'running').length
  )
  const watchActive = useWatchStore((s) =>
    s.views.reduce((n, v) => n + v.stats.queued + v.stats.processing, 0)
  )
  const vendor = useAppStore((s) => s.caps.vendorGuess)
  const updateAvailable = useAppStore((s) => s.updateInfo?.updateAvailable ?? false)
  const accel =
    vendor === 'nvidia'
      ? { name: 'NVIDIA NVENC', on: true }
      : vendor === 'intel'
        ? { name: 'Intel Quick Sync', on: true }
        : vendor === 'amd'
          ? { name: 'AMD AMF', on: true }
          : { name: 'CPU (software)', on: false }

  return (
    <aside className="z-10 flex w-[210px] flex-col border-r border-line px-3 py-4">
      <nav className="flex flex-col gap-1">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="no-drag">
            {({ isActive }) => (
              <div
                className={cn(
                  'relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive ? 'text-frost' : 'text-textDim hover:text-text hover:bg-white/[0.03]'
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-md bg-frost/10 ring-1 ring-inset ring-frost/25"
                    transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                  />
                )}
                <Icon size={18} className="relative z-10" />
                <span className="relative z-10">{label}</span>
                {to === '/queue' && activeJobs > 0 && (
                  <span className="relative z-10 ml-auto rounded-full bg-frost px-1.5 font-mono text-[11px] font-bold text-ink">
                    {activeJobs}
                  </span>
                )}
                {to === '/watch' && watchActive > 0 && (
                  <span className="relative z-10 ml-auto rounded-full bg-frost px-1.5 font-mono text-[11px] font-bold text-ink">
                    {watchActive}
                  </span>
                )}
                {to === '/about' && updateAvailable && (
                  <span className="relative z-10 ml-auto flex h-2 w-2 items-center justify-center">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-frost opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-frost" />
                  </span>
                )}
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Acceleration status readout */}
      <div className="mt-auto overflow-hidden rounded-lg glass p-3.5">
        <div className="flex items-center gap-2">
          <Cpu size={13} className="text-textFaint" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-textFaint">
            Acceleration
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              accel.on ? 'bg-text animate-breathe' : 'bg-textFaint'
            )}
          />
          <span className="text-[13px] font-semibold text-text">{accel.name}</span>
        </div>
        <div className="mt-1 text-[11px] leading-tight text-textFaint">
          {accel.on ? 'Hardware encoding active' : 'No GPU encoder — using CPU'}
        </div>
      </div>
    </aside>
  )
}
