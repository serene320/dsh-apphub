import { DatabaseSync } from 'node:sqlite'
import type { HubSettings, SettingsResult, Note, SaveNote, NoteSaveResult } from '../../contracts.ts'
import type { NotesRepository } from '../../application/notes.ts'

export class SqliteNotesRepository implements NotesRepository {
  private db: DatabaseSync
  constructor(path: string) {
    this.db = new DatabaseSync(path)
    try {
    this.db.exec('PRAGMA busy_timeout=3000')
    const version = (this.db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version
    if (![0, 1, 2, 3].includes(version)) { throw new Error('Unsupported notes schema') }
    this.db.exec(`CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL, revision INTEGER NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL)`)
    this.db.exec('BEGIN IMMEDIATE')
    try {
      if (version < 2) this.db.exec("ALTER TABLE notes ADD COLUMN color TEXT NOT NULL DEFAULT 'cream'")
      if(version < 3) this.db.exec('ALTER TABLE notes ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0; ALTER TABLE notes ADD COLUMN archived INTEGER NOT NULL DEFAULT 0')
      this.db.exec('CREATE TABLE IF NOT EXISTS preferences (key TEXT PRIMARY KEY, value TEXT NOT NULL); PRAGMA user_version=3; COMMIT')
    } catch (error) { this.db.exec('ROLLBACK'); throw error }
    } catch (error) { this.db.close(); throw error }
  }
  settings(): HubSettings {
    const row = this.db.prepare('SELECT value FROM preferences WHERE key=?').get('notes') as {value: string} | undefined
    const value = row ? JSON.parse(row.value) : { appearance: 'host', revision: 0 }
    return {appearance:value.appearance, revision:value.revision}
  }
  saveSettings(value: HubSettings): SettingsResult {
    this.db.exec('BEGIN IMMEDIATE')
    try {
      const current = this.settings()
      if (current.revision !== value.revision) { this.db.exec('ROLLBACK'); return {status: 'conflict', settings: current} }
      const settings = { ...value, revision: value.revision + 1 }
      this.db.prepare('INSERT OR REPLACE INTO preferences VALUES (?,?)').run('notes', JSON.stringify(settings))
      this.db.exec('COMMIT'); return {status: 'saved', settings}
    } catch (error) { this.db.exec('ROLLBACK'); throw error }
  }
  list(): Note[] { return this.db.prepare('SELECT * FROM notes ORDER BY createdAt DESC, id').all().map(n=>({...n,pinned:!!n.pinned,archived:!!n.archived})) as unknown as Note[] }
  save(input: SaveNote): NoteSaveResult {
    this.db.exec('BEGIN IMMEDIATE')
    try {
      const previous = this.db.prepare('SELECT * FROM notes WHERE id=?').get(input.id) as unknown as Note | undefined
      // A retry after a lost acknowledgement must not create or update twice.
      if (previous && previous.revision === input.expectedRevision + 1 && previous.title === input.title && previous.body === input.body && previous.color === (input.color ?? 'cream') && !!previous.pinned === !!input.pinned && !!previous.archived === !!input.archived) {
        this.db.exec('COMMIT'); return { status: 'saved', note: { ...previous,pinned:!!previous.pinned,archived:!!previous.archived } }
      }
      if ((previous?.revision ?? 0) !== input.expectedRevision) {
        this.db.exec('ROLLBACK'); return { status: 'conflict' }
      }
      const now = new Date().toISOString()
      const note: Note = { id: input.id, title: input.title, body: input.body, color: input.color ?? 'cream', pinned: !!input.pinned, archived: !!input.archived, revision: input.expectedRevision + 1, createdAt: previous?.createdAt ?? now, updatedAt: now }
      this.db.prepare('INSERT INTO notes (id,title,body,revision,createdAt,updatedAt,color,pinned,archived) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,body=excluded.body,revision=excluded.revision,updatedAt=excluded.updatedAt,color=excluded.color,pinned=excluded.pinned,archived=excluded.archived').run(note.id, note.title, note.body, note.revision, note.createdAt, note.updatedAt, note.color!,Number(note.pinned),Number(note.archived))
      this.db.exec('COMMIT')
      return { status: 'saved', note }
    } catch (error) { this.db.exec('ROLLBACK'); throw error }
  }
  close() { this.db.close() }
}
