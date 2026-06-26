/**
 * Automated screenshot capture for Frostbyte Desktop.
 * Run after building:  node scripts/take-screenshots.mjs
 * Output:  docs/screenshots/*.png
 */
import { _electron as electron } from 'playwright'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { mkdirSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const out = join(root, 'docs', 'screenshots')
mkdirSync(out, { recursive: true })

// ─── placeholder data ─────────────────────────────────────────────────────────

const MOCK_CAPS = {
  nvenc: { h264: true, hevc: true, av1: false },
  qsv:   { h264: false, hevc: false, av1: false },
  amf:   { h264: false, hevc: false, av1: false },
  vendorGuess: 'nvidia'
}

const MOCK_APP_INFO = {
  version: '1.0.0',
  ffmpegVersion: '7.1.1'
}

const MOCK_OUTPUT_CONFIG = {
  folder: null,
  template: '{name}_frostbyte',
  enableTray: true,
  backgroundMode: false
}

const BASE_SETTINGS = {
  videoCodec: 'h264', preset: 'fast', resolution: '1080p',
  container: 'mp4', crf: 23, audioCodec: 'aac', audioBitrate: '128k',
  audioMode: 'encode', videoMode: 'encode', rateControl: 'crf',
  pixelFormat: 'yuv420p', scaleFlags: 'lanczos', tune: 'film',
  profile: 'high', level: 'auto', bframes: 3, keyint: 250,
  fps: 'source', crop: null, trim: null, threads: 0,
  subtitles: 'none', denoise: false, deinterlace: false, sharpen: false,
  extraArgs: '', rotate: 'none', noUpscale: true,
  targetSize: null, twoPass: false, maxrate: null, bufsize: null,
  bitrate: null, cqp: 28, preferHardware: true, forceEncoder: null,
  customWidth: null, customHeight: null, rawArgsOverride: null
}

const MOCK_WATCH_VIEWS = [
  {
    folder: {
      id: 'wf1',
      path: 'D:\\Gaming\\OBS Recordings',
      enabled: true,
      scope: 'existingAndFuture',
      mode: 'replace',
      safeDelete: 'recycle',
      holdDays: 30,
      presetId: 'fast',
      settings: { ...BASE_SETTINGS },
      schedule: { trigger: 'idle', idleMinutes: 5, requireAcPower: true },
      minSavingsPercent: 5
    },
    stats: { queued: 1, processing: 0, done: 2, skipped: 0, error: 0, totalSavedBytes: 3_663_000_000 },
    files: [
      {
        fingerprint: 'fp1', folderId: 'wf1',
        originalPath: 'D:\\Gaming\\OBS Recordings\\2026-06-20_session.mp4',
        name: '2026-06-20_session.mp4',
        status: 'done',
        outputPath: 'D:\\Gaming\\OBS Recordings\\2026-06-20_session_frostbyte.mp4',
        outputFingerprint: 'fp1o',
        origSizeBytes: 2_847_000_000, outSizeBytes: 412_000_000,
        savedPercent: 85.5, reason: null, updatedAt: Date.now() - 86000000
      },
      {
        fingerprint: 'fp2', folderId: 'wf1',
        originalPath: 'D:\\Gaming\\OBS Recordings\\2026-06-21_ranked.mp4',
        name: '2026-06-21_ranked.mp4',
        status: 'done',
        outputPath: 'D:\\Gaming\\OBS Recordings\\2026-06-21_ranked_frostbyte.mp4',
        outputFingerprint: 'fp2o',
        origSizeBytes: 1_560_000_000, outSizeBytes: 228_000_000,
        savedPercent: 85.4, reason: null, updatedAt: Date.now() - 43000000
      },
      {
        fingerprint: 'fp3', folderId: 'wf1',
        originalPath: 'D:\\Gaming\\OBS Recordings\\2026-06-22_stream.mp4',
        name: '2026-06-22_stream.mp4',
        status: 'queued',
        outputPath: null, outputFingerprint: null,
        origSizeBytes: 3_200_000_000, outSizeBytes: null,
        savedPercent: null, reason: null, updatedAt: Date.now() - 3600000
      }
    ]
  },
  {
    folder: {
      id: 'wf2',
      path: 'D:\\Videos\\Bandicam',
      enabled: true,
      scope: 'futureOnly',
      mode: 'replace',
      safeDelete: 'recycle',
      holdDays: 30,
      presetId: 'balanced',
      settings: { ...BASE_SETTINGS, videoCodec: 'hevc', crf: 24, profile: 'main' },
      schedule: { trigger: 'idle', idleMinutes: 5, requireAcPower: true },
      minSavingsPercent: 10
    },
    stats: { queued: 0, processing: 0, done: 1, skipped: 0, error: 0, totalSavedBytes: 181_000_000 },
    files: [
      {
        fingerprint: 'fp4', folderId: 'wf2',
        originalPath: 'D:\\Videos\\Bandicam\\bandicam_2026-06-15.mp4',
        name: 'bandicam_2026-06-15.mp4',
        status: 'done',
        outputPath: 'D:\\Videos\\Bandicam\\bandicam_2026-06-15_frostbyte.mp4',
        outputFingerprint: 'fp4o',
        origSizeBytes: 616_000_000, outSizeBytes: 435_000_000,
        savedPercent: 29.4, reason: null, updatedAt: Date.now() - 172000000
      }
    ]
  }
]

const BASE_INFO = {
  fps: 60, vcodec: 'h264', acodec: 'aac', pixFmt: 'yuv420p',
  bitDepth: 8, hasAudio: true, hasSubtitles: false
}

const MOCK_QUEUE_ITEMS = [
  {
    id: 'q1',
    info: {
      ...BASE_INFO,
      path: 'D:\\Videos\\gameplay-session.mp4',
      name: 'gameplay-session.mp4',
      sizeBytes: 2_400_000_000,
      durationSec: 3847,
      width: 1920, height: 1080
    },
    settings: { ...BASE_SETTINGS },
    rawArgsOverride: null,
    outputPath: 'D:\\Videos\\gameplay-session_frostbyte.mp4',
    status: 'running',
    progress: {
      id: 'q1', percent: 47.3, fps: 94.2, speed: 6.1,
      outTimeSec: 1805, bitrateKbps: 8400, etaSec: 38, frame: 108300
    },
    result: null,
    error: null
  },
  {
    id: 'q2',
    info: {
      ...BASE_INFO,
      path: 'D:\\Videos\\tutorial-recording.mp4',
      name: 'tutorial-recording.mp4',
      sizeBytes: 890_000_000,
      durationSec: 1420,
      width: 1920, height: 1080
    },
    settings: { ...BASE_SETTINGS },
    rawArgsOverride: null,
    outputPath: 'D:\\Videos\\tutorial-recording_frostbyte.mp4',
    status: 'queued',
    progress: null,
    result: null,
    error: null
  },
  {
    id: 'q3',
    info: {
      ...BASE_INFO,
      path: 'D:\\Videos\\vlog-ep12.mp4',
      name: 'vlog-ep12.mp4',
      sizeBytes: 1_560_000_000,
      durationSec: 2640,
      width: 1920, height: 1080
    },
    settings: { ...BASE_SETTINGS },
    rawArgsOverride: null,
    outputPath: 'D:\\Videos\\vlog-ep12_frostbyte.mp4',
    status: 'done',
    progress: { id: 'q3', percent: 100, fps: 0, speed: 0, outTimeSec: 2640, bitrateKbps: 0, etaSec: 0, frame: 0 },
    result: {
      outputPath: 'D:\\Videos\\vlog-ep12_frostbyte.mp4',
      outputSizeBytes: 234_000_000,
      inputSizeBytes: 1_560_000_000,
      savedPercent: 85,
      elapsedSec: 245
    },
    error: null
  }
]

// ─── helpers ──────────────────────────────────────────────────────────────────

async function inject(page, data) {
  await page.evaluate((d) => {
    const inj = window.__inject__
    if (!inj) { console.warn('[screenshot] __inject__ not found'); return }
    if (d.caps) inj.setCaps(d.caps)
    if (d.appInfo) inj.setAppInfo(d.appInfo)
    if (d.outputConfig) inj.setOutputConfig(d.outputConfig)
    if (d.queueItems) inj.setQueueItems(d.queueItems)
    if (d.watchViews) inj.setWatchViews(d.watchViews)
  }, data)
  await page.waitForTimeout(400)
}

async function navTo(page, hash, waitFor) {
  await page.evaluate((h) => { window.location.hash = h }, hash)
  // wait for framer-motion exit (220ms) + enter (220ms) + rendering buffer
  if (waitFor) {
    await page.waitForSelector(waitFor, { timeout: 8000 }).catch(() => {})
  }
  await page.waitForTimeout(900)
}

async function shot(page, name) {
  const p = join(out, `${name}.png`)
  await page.screenshot({ path: p })
  console.log(`  ✓ ${name}.png`)
  return p
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Launching Frostbyte…')
  const app = await electron.launch({
    args: [join(root, 'out', 'main', 'index.js')],
    timeout: 20000
  })

  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(2500)

  console.log('Injecting base mock data…')
  await inject(page, {
    caps: MOCK_CAPS,
    appInfo: MOCK_APP_INFO,
    outputConfig: MOCK_OUTPUT_CONFIG
  })

  // 1. Compress — clean empty state
  await navTo(page, '/', 'text=Drop a video')
  await shot(page, '01-compress')

  // 2. Queue — active jobs
  await inject(page, { queueItems: MOCK_QUEUE_ITEMS })
  await navTo(page, '/queue', 'text=Queue')
  await shot(page, '02-queue')

  // 3. Watch — two folders with file history
  await inject(page, { watchViews: MOCK_WATCH_VIEWS })
  await navTo(page, '/watch', 'text=Watch Folders')
  await shot(page, '03-watch')

  // 4. Settings
  await navTo(page, '/settings', 'text=Settings')
  await shot(page, '04-settings')

  // 5. About
  await navTo(page, '/about', 'text=Frostbyte')
  await shot(page, '05-about')

  await app.close()
  console.log(`\nAll screenshots saved to  docs/screenshots/`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
