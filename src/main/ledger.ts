import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { WatchFolder, WatchFileRecord, WatchFileStatus, WatchFolderStats } from '@shared/watch'

/**
 * Persistent store for the Watch feature. Two concerns:
 *  - `folders`: the watched-folder configs (survive restarts).
 *  - `files`:   the dedup ledger keyed by quick-fingerprint.
 *
 * Synchronous by design (better-sqlite3) — the main process is the only writer.
 */
export class Ledger {
  private db: Database.Database

  constructor(dbPath = join(app.getPath('userData'), 'watch-ledger.db')) {
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS folders (
        id   TEXT PRIMARY KEY,
        json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS files (
        fingerprint       TEXT PRIMARY KEY,
        folderId          TEXT NOT NULL,
        originalPath      TEXT NOT NULL,
        name              TEXT NOT NULL,
        status            TEXT NOT NULL,
        outputPath        TEXT,
        outputFingerprint TEXT,
        origSizeBytes     INTEGER NOT NULL,
        outSizeBytes      INTEGER,
        savedPercent      REAL,
        reason            TEXT,
        updatedAt         INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_files_folder ON files(folderId);
      CREATE INDEX IF NOT EXISTS idx_files_status ON files(status);
    `)
  }

  // ---- Folders ----

  listFolders(): WatchFolder[] {
    const rows = this.db.prepare('SELECT json FROM folders').all() as { json: string }[]
    return rows.map((r) => JSON.parse(r.json) as WatchFolder)
  }

  getFolder(id: string): WatchFolder | null {
    const row = this.db.prepare('SELECT json FROM folders WHERE id = ?').get(id) as
      | { json: string }
      | undefined
    return row ? (JSON.parse(row.json) as WatchFolder) : null
  }

  saveFolder(folder: WatchFolder): void {
    this.db
      .prepare('INSERT INTO folders (id, json) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET json = excluded.json')
      .run(folder.id, JSON.stringify(folder))
  }

  deleteFolder(id: string): void {
    const tx = this.db.transaction((fid: string) => {
      this.db.prepare('DELETE FROM files WHERE folderId = ?').run(fid)
      this.db.prepare('DELETE FROM folders WHERE id = ?').run(fid)
    })
    tx(id)
  }

  // ---- Files (ledger) ----

  getByFingerprint(fingerprint: string): WatchFileRecord | null {
    const row = this.db.prepare('SELECT * FROM files WHERE fingerprint = ?').get(fingerprint) as
      | WatchFileRecord
      | undefined
    return row ?? null
  }

  upsertFile(rec: WatchFileRecord): void {
    this.db
      .prepare(
        `INSERT INTO files
          (fingerprint, folderId, originalPath, name, status, outputPath, outputFingerprint,
           origSizeBytes, outSizeBytes, savedPercent, reason, updatedAt)
         VALUES
          (@fingerprint, @folderId, @originalPath, @name, @status, @outputPath, @outputFingerprint,
           @origSizeBytes, @outSizeBytes, @savedPercent, @reason, @updatedAt)
         ON CONFLICT(fingerprint) DO UPDATE SET
           folderId=excluded.folderId, originalPath=excluded.originalPath, name=excluded.name,
           status=excluded.status, outputPath=excluded.outputPath, outputFingerprint=excluded.outputFingerprint,
           origSizeBytes=excluded.origSizeBytes, outSizeBytes=excluded.outSizeBytes,
           savedPercent=excluded.savedPercent, reason=excluded.reason, updatedAt=excluded.updatedAt`
      )
      .run(rec)
  }

  markStatus(
    fingerprint: string,
    status: WatchFileStatus,
    patch: Partial<WatchFileRecord> = {}
  ): void {
    const existing = this.getByFingerprint(fingerprint)
    if (!existing) return
    this.upsertFile({ ...existing, ...patch, status, updatedAt: Math.floor(nowMs() / 1000) })
  }

  listFiles(folderId: string): WatchFileRecord[] {
    return this.db
      .prepare(
        `SELECT * FROM files
         WHERE folderId = ? AND (reason IS NULL OR reason != 'Frostbyte output')
         ORDER BY updatedAt DESC`
      )
      .all(folderId) as WatchFileRecord[]
  }

  /** Next queued item across all folders (FIFO), optionally limited to enabled folders. */
  nextQueued(enabledFolderIds: string[]): WatchFileRecord | null {
    if (!enabledFolderIds.length) return null
    const placeholders = enabledFolderIds.map(() => '?').join(',')
    const row = this.db
      .prepare(
        `SELECT * FROM files WHERE status = 'queued' AND folderId IN (${placeholders})
         ORDER BY updatedAt ASC LIMIT 1`
      )
      .get(...enabledFolderIds) as WatchFileRecord | undefined
    return row ?? null
  }

  stats(folderId: string): WatchFolderStats {
    const rows = this.db
      .prepare(
        `SELECT status, COUNT(*) c, COALESCE(SUM(origSizeBytes - outSizeBytes),0) saved
         FROM files
         WHERE folderId = ? AND (reason IS NULL OR reason != 'Frostbyte output')
         GROUP BY status`
      )
      .all(folderId) as { status: WatchFileStatus; c: number; saved: number }[]
    const stats: WatchFolderStats = {
      queued: 0,
      processing: 0,
      done: 0,
      skipped: 0,
      error: 0,
      totalSavedBytes: 0
    }
    for (const r of rows) {
      if (r.status === 'done') stats.totalSavedBytes += r.saved
      if (r.status in stats) (stats as unknown as Record<string, number>)[r.status] = r.c
    }
    return stats
  }

  /** Reset any rows stuck in 'processing' back to 'queued' (app was killed mid-encode). */
  resetStuckProcessing(): void {
    this.db
      .prepare(
        `UPDATE files SET status = 'queued', updatedAt = ?
         WHERE status = 'processing' AND (reason IS NULL OR reason != 'Frostbyte output')`
      )
      .run(Math.floor(Date.now() / 1000))
  }

  close(): void {
    this.db.close()
  }
}

// Date.now() isolated here so the rest of the module stays pure-ish and testable.
function nowMs(): number {
  return Date.now()
}
