/**
 * Computes the video bitrate (kbps) needed to fit a target file size.
 * Used by the "fit under X MB" presets (two-pass for accuracy).
 */
export function bitrateForTargetSize(
  targetMB: number,
  durationSec: number,
  audioKbps: number
): number {
  if (durationSec <= 0) return 1000
  const totalKbits = targetMB * 8 * 1024 // MB -> kbit (1024-based)
  const safety = 0.97 // muxing overhead headroom
  const audioTotal = audioKbps * durationSec
  const videoKbps = ((totalKbits * safety) - audioTotal) / durationSec
  return Math.max(50, Math.floor(videoKbps))
}
