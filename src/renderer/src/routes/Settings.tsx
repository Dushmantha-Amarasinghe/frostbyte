import { useState, useEffect } from 'react'
import { Settings2, FolderOpen } from 'lucide-react'
import { Segmented, Toggle, Field } from '@renderer/components/ui'
import { useAppStore } from '@renderer/store/appStore'
import { OutputConfig } from '@shared/ipc-contract'

const TOKENS = ['{name}', '{date}', '{codec}', '{res}']

export function Settings(): React.JSX.Element {
  const { outputConfig, setOutputConfig: storeSet } = useAppStore()
  const [startWithWindows, setStartWithWindows] = useState(false)
  const [folderMode, setFolderMode] = useState<'source' | 'custom'>(
    outputConfig.folder ? 'custom' : 'source'
  )

  useEffect(() => {
    window.frostbyte.getStartup().then(setStartWithWindows).catch(() => {})
  }, [])
  const [folder, setFolder] = useState(outputConfig.folder ?? '')
  const [template, setTemplate] = useState(outputConfig.template || '{name}_frostbyte')

  const save = (patch: Partial<OutputConfig>): void => {
    const next = { ...outputConfig, ...patch }
    storeSet(next)
    window.frostbyte.setOutputConfig(next).catch(() => {})
  }

  const handleModeChange = (mode: 'source' | 'custom'): void => {
    setFolderMode(mode)
    if (mode === 'source') save({ folder: null })
  }

  const browseFolder = async (): Promise<void> => {
    const dir = await window.frostbyte.chooseOutputDir()
    if (!dir) return
    setFolder(dir)
    save({ folder: dir })
  }

  const insertToken = (token: string): void => {
    const next = template + token
    setTemplate(next)
    save({ template: next })
  }

  const handleTemplate = (val: string): void => {
    setTemplate(val)
    save({ template: val })
  }

  return (
    <div className="mx-auto max-w-3xl px-10 py-9">
      <div className="mb-8">
        <h1 className="flex items-center gap-2.5 font-display text-2xl font-semibold tracking-tight text-text">
          <Settings2 size={22} className="text-frost" />
          Settings
        </h1>
        <p className="mt-1 text-sm text-textDim">Configure output and app behavior.</p>
      </div>

      <div className="space-y-3">
        {/* Output */}
        <div className="overflow-hidden rounded-xl glass p-5 space-y-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#AEAEB5]">
            Output
          </div>

          <Field label="Save location">
            <Segmented
              value={folderMode}
              onChange={handleModeChange}
              options={[
                { label: 'Same as source', value: 'source' },
                { label: 'Custom folder', value: 'custom' }
              ]}
            />
          </Field>

          {folderMode === 'custom' && (
            <>
              <Field label="Folder">
                <div className="flex gap-2">
                  <div className="min-w-0 flex-1 truncate rounded-md border border-white/10 bg-panel2 px-3 py-2 font-mono text-xs text-textDim">
                    {folder || 'No folder selected'}
                  </div>
                  <button
                    onClick={browseFolder}
                    className="no-drag flex shrink-0 items-center gap-1.5 rounded-md border border-white/10 bg-panel2 px-3 py-2 text-xs text-textDim transition-colors hover:border-white/20 hover:text-text"
                  >
                    <FolderOpen size={13} />
                    Browse
                  </button>
                </div>
              </Field>

              <Field label="Filename" hint="Extension is added automatically">
                <div className="space-y-2">
                  <input
                    value={template}
                    onChange={(e) => handleTemplate(e.target.value)}
                    placeholder="{name}_frostbyte"
                    className="no-drag w-full rounded-md border border-white/10 bg-panel2 px-3 py-2 font-mono text-xs text-text outline-none transition-colors focus:border-white/25"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-textFaint">Insert:</span>
                    {TOKENS.map((t) => (
                      <button
                        key={t}
                        onClick={() => insertToken(t)}
                        className="no-drag rounded px-2 py-0.5 font-mono text-[10px] text-textDim bg-white/[0.04] hover:bg-white/[0.08] hover:text-text transition-colors"
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </Field>
            </>
          )}
        </div>

        {/* Background */}
        <div className="overflow-hidden rounded-xl glass p-5 space-y-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#AEAEB5]">
            Background
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-text">Start with Windows</div>
              <div className="text-xs text-textFaint">
                Launch Frostbyte automatically when you sign in
              </div>
            </div>
            <Toggle
              checked={startWithWindows}
              onChange={(v) => {
                setStartWithWindows(v)
                window.frostbyte.setStartup(v).catch(() => {})
              }}
            />
          </div>
          <div className="flex items-center justify-between border-t border-line pt-4">
            <div>
              <div className="text-sm font-semibold text-text">Run in system tray</div>
              <div className="text-xs text-textFaint">
                Keep Frostbyte running when the window is closed
              </div>
            </div>
            <Toggle
              checked={outputConfig.enableTray ?? false}
              onChange={(v) => save({ enableTray: v })}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
