import { useEffect, useState } from 'react'
import { Terminal, Copy, Check } from 'lucide-react'
import { CompressionSettings } from '@shared/settings'
import { MediaInfo } from '@shared/ipc-contract'
import { useFilesStore } from '@renderer/store/filesStore'

const SAMPLE: MediaInfo = {
  path: 'C:/videos/input.mp4',
  name: 'input.mp4',
  sizeBytes: 0,
  durationSec: 120,
  width: 1920,
  height: 1080,
  fps: 30,
  vcodec: 'h264',
  acodec: 'aac',
  pixFmt: 'yuv420p',
  bitDepth: 8,
  hasAudio: true,
  hasSubtitles: false
}

export function CommandPreview({ settings }: { settings: CompressionSettings }): React.JSX.Element {
  const firstFile = useFilesStore((s) => s.files[0])
  const [display, setDisplay] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let alive = true
    window.frostbyte
      .previewCommand({ settings, input: firstFile ?? SAMPLE })
      .then((r) => alive && setDisplay(r.display))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [settings, firstFile])

  const copy = (): void => {
    navigator.clipboard.writeText(display)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="overflow-hidden rounded-lg glass">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <div className="flex items-center gap-2 text-frost">
          <Terminal size={14} />
          <span className="font-mono text-[11px] uppercase tracking-[0.18em]">Command</span>
        </div>
        <button
          onClick={copy}
          className="no-drag flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium text-textDim transition-colors hover:bg-white/5 hover:text-text"
        >
          {copied ? <Check size={13} className="text-frost" /> : <Copy size={13} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="max-h-28 overflow-auto px-4 py-3 font-mono text-xs leading-relaxed text-textDim">
        {display || '…'}
      </pre>
    </div>
  )
}
