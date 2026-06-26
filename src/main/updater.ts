import { app } from 'electron'
import { isNewer } from '@shared/version'
import { UpdateCheckResult } from '@shared/ipc-contract'

// Set when the user provides their GitHub repo.
const REPO = { owner: 'PLACEHOLDER_OWNER', repo: 'PLACEHOLDER_REPO' }

export async function checkForUpdate(): Promise<UpdateCheckResult> {
  const currentVersion = app.getVersion()
  const base: UpdateCheckResult = {
    currentVersion,
    latestVersion: null,
    updateAvailable: false,
    releaseUrl: null,
    releaseNotes: null,
    error: null
  }

  if (REPO.owner.startsWith('PLACEHOLDER')) {
    return { ...base, error: 'No update source configured yet.' }
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO.owner}/${REPO.repo}/releases/latest`,
      {
        headers: {
          'User-Agent': 'Frostbyte',
          Accept: 'application/vnd.github+json'
        }
      }
    )
    if (!res.ok) {
      if (res.status === 404) return { ...base, error: 'No releases published yet.' }
      return { ...base, error: `GitHub returned ${res.status}` }
    }
    const data = (await res.json()) as {
      tag_name?: string
      html_url?: string
      body?: string
    }
    const latestVersion = (data.tag_name ?? '').replace(/^v/i, '')
    if (!latestVersion) return { ...base, error: 'Could not read latest version.' }
    return {
      ...base,
      latestVersion,
      updateAvailable: isNewer(latestVersion, currentVersion),
      releaseUrl: data.html_url ?? null,
      releaseNotes: data.body ?? null
    }
  } catch (e) {
    return { ...base, error: e instanceof Error ? e.message : 'Network error' }
  }
}
