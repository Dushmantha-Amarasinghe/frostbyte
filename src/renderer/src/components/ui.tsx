import { ReactNode, useId, useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

export function Button({
  children,
  onClick,
  variant = 'secondary',
  className,
  disabled,
  size = 'md'
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  className?: string
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
}): React.JSX.Element {
  const variants = {
    primary:
      'text-text font-semibold bg-panel2 border border-white/10 hover:bg-[#26262a] hover:border-white/20',
    secondary: 'glass text-text hover:border-white/16',
    ghost: 'text-textDim hover:text-text hover:bg-white/5',
    danger: 'bg-dangerBg text-danger border border-danger/25 hover:border-danger/50'
  }
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2.5 text-sm', lg: 'px-6 py-3.5 text-[15px]' }
  return (
    <motion.button
      whileHover={disabled ? undefined : { y: -1 }}
      whileTap={disabled ? undefined : { scale: 0.985 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'no-drag inline-flex items-center justify-center gap-2 rounded-md transition-colors disabled:opacity-40 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {children}
    </motion.button>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className
}: {
  options: { label: string; value: T }[]
  value: T
  onChange: (v: T) => void
  className?: string
}): React.JSX.Element {
  const groupId = useId()
  return (
    <div className={cn('relative flex gap-0.5 rounded-md bg-[#0d0d0f] p-1 border border-white/[0.06]', className)}>
      {options.map((o) => {
        const active = value === o.value
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className="no-drag relative flex-1 rounded px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none"
          >
            {active && (
              <motion.span
                layoutId={`seg-${groupId}`}
                className="absolute inset-0 rounded bg-white/[0.07] border border-white/[0.15] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                transition={{ type: 'spring', stiffness: 500, damping: 34 }}
              />
            )}
            <span className={cn('relative z-10', active ? 'text-text font-semibold' : 'text-textDim')}>
              {o.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function Toggle({
  checked,
  onChange
}: {
  checked: boolean
  onChange: (v: boolean) => void
}): React.JSX.Element {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        'no-drag relative flex h-5 w-9 shrink-0 items-center rounded-full border px-0.5 transition-colors duration-150',
        checked ? 'border-white/25 bg-white/20' : 'border-white/10 bg-white/5'
      )}
    >
      <motion.span
        initial={false}
        animate={{ x: checked ? 16 : 0 }}
        transition={{ type: 'spring', stiffness: 700, damping: 38 }}
        className="h-3.5 w-3.5 rounded-full"
        style={{ backgroundColor: checked ? '#ffffff' : '#6b6b72' }}
      />
    </button>
  )
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  badge
}: {
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  badge?: string
}): React.JSX.Element {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ ['--pct' as string]: `${pct}%` }}
        className="no-drag flex-1"
      />
      <span className="min-w-[46px] rounded bg-panel2 border border-white/10 px-2 py-1 text-center font-mono text-xs text-text">
        {badge ?? value}
      </span>
    </div>
  )
}

export function NumberInput({
  value,
  onChange,
  suffix,
  className,
  placeholder
}: {
  value: number | null | undefined
  onChange: (v: number) => void
  suffix?: string
  className?: string
  placeholder?: string
}): React.JSX.Element {
  return (
    <div className={cn('flex items-center rounded-md bg-panel2 border border-white/10 focus-within:border-white/25 transition-colors', className)}>
      <input
        type="number"
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange(parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0)}
        className="no-drag w-full bg-transparent px-3 py-2 font-mono text-sm text-text outline-none"
      />
      {suffix && <span className="px-3 font-mono text-xs text-textFaint">{suffix}</span>}
    </div>
  )
}

/* Custom Select — menu is portaled to <body> so the parent's overflow:hidden can't clip it */
export function Select<T extends string>({
  value,
  options,
  onChange
}: {
  value: T
  options: { label: string; value: T }[]
  onChange: (v: T) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<{ left: number; top: number; bottom: number; width: number } | null>(null)
  const [flipUp, setFlipUp] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const selected = options.find((o) => o.value === value)

  const MENU_MAX = 280 // px, matches max-h below
  const measure = (): void => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const spaceBelow = window.innerHeight - r.bottom
    const needed = Math.min(MENU_MAX, options.length * 38 + 8)
    setFlipUp(spaceBelow < needed && r.top > spaceBelow)
    setRect({ left: r.left, top: r.top, bottom: r.bottom, width: r.width })
  }

  const toggle = (): void => {
    if (!open) measure()
    setOpen((v) => !v)
  }

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent): void => {
      const t = e.target as Node
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false)
    }
    const onReposition = (): void => measure()
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('scroll', onReposition, true)
    window.addEventListener('resize', onReposition)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('scroll', onReposition, true)
      window.removeEventListener('resize', onReposition)
    }
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        onClick={toggle}
        className={cn(
          'no-drag w-full flex items-center justify-between rounded-md bg-panel2 border px-3 py-2 text-sm font-medium text-text transition-colors cursor-pointer focus:outline-none',
          open ? 'border-white/20' : 'border-white/10 hover:border-white/20'
        )}
      >
        <span>{selected?.label ?? value}</span>
        <ChevronDown
          size={15}
          className={cn('text-textFaint transition-transform duration-150', open && 'rotate-180')}
        />
      </button>

      {createPortal(
        <AnimatePresence>
          {open && rect && (
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, y: flipUp ? 4 : -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: flipUp ? 4 : -4, scale: 0.98 }}
              transition={{ duration: 0.1, ease: 'easeOut' }}
              style={{
                position: 'fixed',
                left: rect.left,
                width: rect.width,
                ...(flipUp
                  ? { bottom: window.innerHeight - rect.top + 4 }
                  : { top: rect.bottom + 4 })
              }}
              className="z-[9999] max-h-[280px] overflow-y-auto rounded-md border border-white/10 bg-panel2 shadow-lift"
            >
              {options.map((o) => {
                const active = o.value === value
                return (
                  <button
                    key={o.value}
                    onClick={() => {
                      onChange(o.value)
                      setOpen(false)
                    }}
                    className={cn(
                      'no-drag flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-white/[0.06] focus:outline-none',
                      active ? 'text-text font-medium bg-white/5' : 'text-textDim'
                    )}
                  >
                    {o.label}
                    {active && <Check size={13} className="text-textDim" />}
                  </button>
                )
              })}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}

export function Label({ children }: { children: ReactNode }): React.JSX.Element {
  return <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#AEAEB5]">{children}</div>
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }): React.JSX.Element {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {hint && <div className="text-xs text-textFaint">{hint}</div>}
    </div>
  )
}

export function Panel({
  title,
  icon,
  children,
  defaultOpen = false
}: {
  title: string
  icon?: ReactNode
  children: ReactNode
  defaultOpen?: boolean
}): React.JSX.Element {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="overflow-hidden rounded-lg glass">
      <button
        onClick={() => setOpen(!open)}
        className="no-drag flex w-full items-center justify-between px-4 py-3.5 transition-colors hover:bg-white/[0.03]"
      >
        <div className="flex items-center gap-2.5">
          {icon && <span className="text-textDim">{icon}</span>}
          <span className="font-display text-sm font-semibold tracking-tight text-text">{title}</span>
        </div>
        <ChevronDown size={18} className={cn('text-textFaint transition-transform', open && 'rotate-180')} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-4 border-t border-line px-4 py-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
