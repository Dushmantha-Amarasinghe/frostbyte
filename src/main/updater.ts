import { app } from 'electron'
import { createWriteStream } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { spawn } from 'child_process'
import { isNewer } from '@shared/version'
import { IPC, UpdateCheckResult } from '@shared/ipc-contract'

const REPO = { owner: 'Dushmantha-Amarasinghe', repo: 'frostbyte' }
const CHECK_DELAY_MS = 8_000          // wait 8s after launch before first check
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000 // then every 24 h

export async function checkForUpdate(): Promise<UpdateCheckResult> {
  const currentVersion = app.getVersion()
  const base: UpdateCheckResult = {
    currentVersion,
    latestVersion: null,
    updateAvailable: false,
    releaseUrl: null,
    downloadUrl: null,
    releaseNotes: null,
    error: null
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO.owner}/${REPO.repo}/releases/latest`,
      { headers: { 'User-Agent': 'Frostbyte', Accept: 'application/vnd.github+json' } }
    )
    if (!res.ok) {
      if (res.status === 404) return { ...base, error: 'No releases published yet.' }
      return { ...base, error: `GitHub returned ${res.status}` }
    }

    const data = (await res.json()) as {
      tag_name?: string
      html_url?: string
      body?: string
      assets?: { name: string; browser_download_url: string }[]
    }

    const latestVersion = (data.tag_name ?? '').replace(/^v/i, '')
    if (!latestVersion) return { ...base, error: 'Could not read latest version.' }

    const exeAsset = data.assets?.find((a) => a.name.endsWith('.exe') && !a.name.includes('blockmap'))
    const updateAvailable = isNewer(latestVersion, currentVersion)

    return {
      ...base,
      latestVersion,
      updateAvailable,
      releaseUrl: data.html_url ?? null,
      downloadUrl: updateAvailable ? (exeAsset?.browser_download_url ?? null) : null,
      releaseNotes: data.body ?? null
    }
  } catch (e) {
    return { ...base, error: e instanceof Error ? e.message : 'Network error' }
  }
}

/** Download installer to temp dir, run it, quit the app. */
export async function downloadAndInstall(
  url: string,
  onProgress: (percent: number) => void
): Promise<void> {
  const tmpPath = join(tmpdir(), 'frostbyte-update.exe')

  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok || !res.body) throw new Error(`Download failed: ${res.status}`)

  const total = parseInt(res.headers.get('content-length') ?? '0', 10)
  let received = 0

  const writer = createWriteStream(tmpPath)
  const reader = res.body.getReader()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    writer.write(Buffer.from(value))
    received += value.length
    if (total > 0) onProgress(Math.min(99, Math.round((received / total) * 100)))
  }

  await new Promise<void>((resolve, reject) => writer.end((err) => (err ? reject(err) : resolve())))
  onProgress(100)

  const proc = spawn(tmpPath, [], { detached: true, stdio: 'ignore', windowsHide: false })
  proc.unref()
  setTimeout(() => app.quit(), 800)
}

/**
 * Schedule background update checks.
 * emit(channel, payload) sends to the renderer window.
 */
export function startAutoUpdater(emit: (channel: string, data?: unknown) => void): void {
  const run = async (): Promise<void> => {
    try {
      const result = await checkForUpdate()
      if (result.updateAvailable) emit(IPC.evtUpdateAvailable, result)
    } catch {
      // silently ignore — not worth crashing over
    }
  }

  setTimeout(run, CHECK_DELAY_MS)
  setInterval(run, CHECK_INTERVAL_MS)
}
