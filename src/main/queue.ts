import { randomUUID } from 'crypto'
import { CompressionSettings } from '@shared/settings'
import { MediaInfo, QueueItem, ProgressEvent, JobResult, OutputConfig } from '@shared/ipc-contract'
import { EncoderCapabilities } from '@shared/encoders'
import { runJob, RunningJob } from './job-runner'
import { resolveOutputPath } from './output'
import { cachedCaps } from './encoder-detect'

type Emit = (channel: string, payload: unknown) => void

export class Queue {
  private items: QueueItem[] = []
  private running: { id: string; job: RunningJob } | null = null
  private processing = false
  private paused = false
  private outputConfig: OutputConfig
  private caps: () => EncoderCapabilities = cachedCaps

  constructor(
    private emit: Emit,
    outputConfig: OutputConfig
  ) {
    this.outputConfig = outputConfig
  }

  setOutputConfig(c: OutputConfig): void {
    this.outputConfig = c
  }

  snapshot(): QueueItem[] {
    return this.items.map((i) => ({ ...i }))
  }

  private changed(): void {
    this.emit('queue:changed', this.snapshot())
  }

  add(infos: MediaInfo[], settings: CompressionSettings): QueueItem[] {
    const added = infos.map((info) => {
      const item: QueueItem = {
        id: randomUUID(),
        info,
        settings: { ...settings },
        rawArgsOverride: null,
        outputPath: resolveOutputPath(info, settings, this.outputConfig),
        status: 'queued',
        progress: null,
        result: null,
        error: null
      }
      return item
    })
    this.items.push(...added)
    this.changed()
    return added
  }

  updateItem(id: string, settings: CompressionSettings, rawArgsOverride?: string | null): void {
    const it = this.items.find((i) => i.id === id)
    if (!it || it.status === 'running') return
    it.settings = { ...settings }
    if (rawArgsOverride !== undefined) it.rawArgsOverride = rawArgsOverride
    it.outputPath = resolveOutputPath(it.info, settings, this.outputConfig)
    this.changed()
  }

  remove(id: string): void {
    if (this.running?.id === id) this.cancelItem(id)
    this.items = this.items.filter((i) => i.id !== id)
    this.changed()
  }

  reorder(ids: string[]): void {
    const map = new Map(this.items.map((i) => [i.id, i]))
    const next = ids.map((id) => map.get(id)).filter(Boolean) as QueueItem[]
    // keep any items not in ids (e.g. running) at their place
    for (const i of this.items) if (!ids.includes(i.id)) next.push(i)
    this.items = next
    this.changed()
  }

  start(): void {
    this.paused = false
    void this.processNext()
  }

  pause(): void {
    this.paused = true
  }

  cancelItem(id: string): void {
    if (this.running?.id === id) {
      this.running.job.cancel()
    } else {
      const it = this.items.find((i) => i.id === id)
      if (it && it.status === 'queued') {
        it.status = 'cancelled'
        this.changed()
      }
    }
  }

  cancelAll(): void {
    this.paused = true
    if (this.running) this.running.job.cancel()
    for (const it of this.items) if (it.status === 'queued') it.status = 'cancelled'
    this.changed()
  }

  private async processNext(): Promise<void> {
    if (this.processing || this.paused) return
    const next = this.items.find((i) => i.status === 'queued')
    if (!next) return

    this.processing = true
    next.status = 'running'
    next.progress = null
    next.error = null
    this.emit('job:start', { id: next.id })
    this.changed()

    let lastEmit = 0
    const onProgress = (e: ProgressEvent): void => {
      next.progress = e
      const now = Date.now()
      if (now - lastEmit > 200) {
        lastEmit = now
        this.emit('job:progress', e)
      }
    }

    const job = runJob(next, this.caps(), onProgress)
    this.running = { id: next.id, job }

    try {
      const result: JobResult = await job.promise
      next.status = 'done'
      next.result = result
      next.progress = {
        id: next.id,
        percent: 100,
        fps: 0,
        speed: 0,
        outTimeSec: 0,
        bitrateKbps: 0,
        etaSec: 0,
        frame: 0
      }
      this.emit('job:complete', { id: next.id, result })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      if (msg === 'Cancelled') {
        next.status = 'cancelled'
      } else {
        next.status = 'error'
        next.error = msg
        this.emit('job:error', { id: next.id, message: msg, stderrTail: msg })
      }
    } finally {
      this.running = null
      this.processing = false
      this.changed()
      if (!this.paused) void this.processNext()
    }
  }
}
