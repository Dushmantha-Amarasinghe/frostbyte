import { createHash } from 'crypto'
import { open, stat } from 'fs/promises'

const SAMPLE_BYTES = 8 * 1024 * 1024 // 8MB head + 8MB tail

/**
 * A cheap, collision-proof-in-practice identity for a media file:
 *   size + sha256(first 8MB) + sha256(last 8MB) + duration.
 *
 * O(constant) regardless of file size — hashing 16MB of a 50GB movie is instant.
 * Deliberately ignores filename and mtime so rename / re-modified-date can't fool it.
 */
export async function computeFingerprint(path: string, durationSec: number): Promise<string> {
  const { size } = await stat(path)
  const hash = createHash('sha256')
  hash.update(`s${size}|d${Math.round(durationSec)}|`)

  const fh = await open(path, 'r')
  try {
    const headLen = Math.min(SAMPLE_BYTES, size)
    const head = Buffer.alloc(headLen)
    await fh.read(head, 0, headLen, 0)
    hash.update(head)

    // Tail — only when the file is large enough that head and tail don't overlap.
    if (size > SAMPLE_BYTES * 2) {
      const tail = Buffer.alloc(SAMPLE_BYTES)
      await fh.read(tail, 0, SAMPLE_BYTES, size - SAMPLE_BYTES)
      hash.update(tail)
    }
  } finally {
    await fh.close()
  }

  return hash.digest('hex')
}
