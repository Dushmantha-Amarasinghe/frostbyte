interface Props {
  size?: number
  className?: string
  glow?: boolean
}

/**
 * Frostbyte brand mark — a crystalline 6-fold snowflake with an icy gradient.
 * Each arm has a faceted shaft, side branches, and a diamond crystal node.
 */
export function Snowflake({ size = 28, className, glow = false }: Props): React.JSX.Element {
  const arms = [0, 60, 120, 180, 240, 300]
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      style={glow ? { filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.25))' } : undefined}
    >
      <defs>
        <linearGradient id="frostGrad" gradientUnits="userSpaceOnUse" x1="22" y1="12" x2="78" y2="88">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="50%" stopColor="#d4d4d8" />
          <stop offset="100%" stopColor="#9a9aa1" />
        </linearGradient>
      </defs>
      <g
        stroke="url(#frostGrad)"
        strokeWidth={3.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {arms.map((a) => (
          <g key={a} transform={`rotate(${a} 50 50)`}>
            {/* main shaft */}
            <line x1="50" y1="50" x2="50" y2="12" />
            {/* inner branches */}
            <line x1="50" y1="26" x2="42" y2="18" />
            <line x1="50" y1="26" x2="58" y2="18" />
            {/* outer branches */}
            <line x1="50" y1="18" x2="44" y2="11" />
            <line x1="50" y1="18" x2="56" y2="11" />
            {/* crystal tip */}
            <path d="M50 12 l-3.2 4 3.2 4 3.2 -4 z" fill="url(#frostGrad)" />
          </g>
        ))}
        {/* center hex node */}
        <circle cx="50" cy="50" r="5.2" fill="#0b0d10" />
        <circle cx="50" cy="50" r="3" fill="url(#frostGrad)" stroke="none" />
      </g>
    </svg>
  )
}
