import { execFile } from 'child_process'
import { promisify } from 'util'
import { ffprobePath } from './ffmpeg-path'

const execFileAsync = promisify(execFile)

/** Metadata key stamped into every Frostbyte-compressed output. */
export const PROVENANCE_KEY = 'frostbyte'
const VERSION = 'v1'

export interface ProvTag {
  version: string
  preset: string
  origSize: number
  ts: number
}

/** Builds the metadata value, e.g. "v1;preset=balanced;orig=12345678;ts=1700000000". */
export function provenanceValue(presetId: string | null, origSizeBytes: number, tsSec: number): string {
  return `${VERSION};preset=${presetId ?? 'custom'};orig=${origSizeBytes};ts=${tsSec}`
}

/** ffmpeg args that stamp the provenance tag into the output container. */
export function provenanceArgs(value: string): string[] {
  return ['-metadata', `${PROVENANCE_KEY}=${value}`]
}

function parseProvenance(raw: string): ProvTag | null {
  if (!raw.startsWith('v')) return null
  const parts = raw.split(';')
  const tag: ProvTag = { version: parts[0], preset: 'custom', origSize: 0, ts: 0 }
  for (const p of parts.slice(1)) {
    const [k, v] = p.split('=')
    if (k === 'preset') tag.preset = v
    else if (k === 'orig') tag.origSize = parseInt(v, 10) || 0
    else if (k === 'ts') tag.ts = parseInt(v, 10) || 0
  }
  return tag
}

/**
 * Reads only the container header tags (cheap even for a 50GB file) and returns
 * the Frostbyte provenance tag if present. This is the strong "is this ours?"
 * signal — it lives inside the file, so it survives rename / move / mtime change.
 */
export async function readProvenance(path: string): Promise<ProvTag | null> {
  try {
    const { stdout } = await execFileAsync(
      ffprobePath(),
      ['-v', 'error', '-show_entries', 'format_tags', '-of', 'json', path],
      { maxBuffer: 1024 * 1024 }
    )
    const data = JSON.parse(stdout)
    const tags = data.format?.tags ?? {}
    // ffprobe lowercases tag keys.
    const raw: string | undefined = tags[PROVENANCE_KEY] ?? tags[PROVENANCE_KEY.toUpperCase()]
    return raw ? parseProvenance(raw) : null
  } catch {
    return null
  }
}
