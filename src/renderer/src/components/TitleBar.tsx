import { Snowflake } from './Snowflake'

export function TitleBar(): React.JSX.Element {
  return (
    <div className="drag relative z-20 flex h-8 items-center justify-between border-b border-line pl-3">
      <div className="flex items-center gap-2">
        <Snowflake size={13} />
        <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-textDim">
          Frostbyte
        </span>
      </div>
      <div className="no-drag flex h-full items-center gap-1.5 pr-2.5">
        {/* Windows order: minimize · maximize · close — styled as Apple traffic dots */}
        <Dot onClick={() => window.frostbyte.windowMinimize()} color="#FFBD2E" symbol="−" />
        <Dot onClick={() => window.frostbyte.windowMaximize()} color="#28C840" symbol="⤢" />
        <Dot onClick={() => window.frostbyte.windowClose()} color="#FF5F57" symbol="×" />
      </div>
    </div>
  )
}

function Dot({
  onClick,
  color,
  symbol
}: {
  onClick: () => void
  color: string
  symbol: string
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className="no-drag group flex h-6 w-6 items-center justify-center"
    >
      <span
        className="relative flex h-3 w-3 items-center justify-center rounded-full transition-all group-hover:scale-110"
        style={{ backgroundColor: color }}
      >
        <span className="absolute text-[7px] font-black leading-none text-black/50 opacity-0 transition-opacity group-hover:opacity-100">
          {symbol}
        </span>
      </span>
    </button>
  )
}
