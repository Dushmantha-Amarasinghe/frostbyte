import { motion } from 'framer-motion'
import { cn } from '@renderer/lib/utils'

export function ProgressBar({
  percent,
  className,
  height = 'h-2'
}: {
  percent: number
  className?: string
  height?: string
}): React.JSX.Element {
  const p = Math.max(0, Math.min(100, percent))
  return (
    <div className={cn('w-full overflow-hidden rounded-full bg-black/40 hairline', height, className)}>
      <motion.div
        className="shimmer-mask relative h-full rounded-full bg-gradient-to-r from-[#8a8a90] via-[#cfcfd4] to-white"
        initial={false}
        animate={{ width: `${p}%` }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      />
    </div>
  )
}
