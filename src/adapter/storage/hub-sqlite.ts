import { DatabaseSync } from 'node:sqlite'
import type { HubSettings, SettingsResult } from '../../contracts.ts'
import type { TaskRow } from '../../application/apphub-service.ts'
export class HubRepository {
  readonly db: DatabaseSync
  constructor(path:string) {
    this.db=new DatabaseSync(path)
    try {
    this.db.exec('PRAGMA busy_timeout=3000')
    const version=this.db.prepare('PRAGMA user_version').get()!.user_version
    if(version!==0&&version!==1){throw Error('Unsupported hub schema')}
    this.db.exec(`CREATE TABLE IF NOT EXISTS preferences(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS apps(id TEXT PRIMARY KEY,operation TEXT NOT NULL);
      INSERT OR IGNORE INTO apps VALUES('notes','notes.create');
      CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY,sessionId TEXT NOT NULL,noteId TEXT UNIQUE NOT NULL,app TEXT NOT NULL,operation TEXT NOT NULL,callKey TEXT UNIQUE,payload TEXT,status TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS migrations(id TEXT PRIMARY KEY); PRAGMA user_version=1`)
    } catch(error) {this.db.close();throw error}
  }
  settings():HubSettings {const row=this.db.prepare("SELECT value FROM preferences WHERE key='hub'").get();return row?JSON.parse(String(row.value)):{appearance:'host',revision:0}}
  saveSettings(value:HubSettings):SettingsResult {
    this.db.exec('BEGIN IMMEDIATE')
    try {const current=this.settings();if(current.revision!==value.revision){this.db.exec('ROLLBACK');return {status:'conflict',settings:current}}
      const settings={...value,revision:value.revision+1};this.db.prepare("INSERT OR REPLACE INTO preferences VALUES('hub',?)").run(JSON.stringify(settings));this.db.exec('COMMIT');return {status:'saved',settings}
    }catch(error){this.db.exec('ROLLBACK');throw error}
  }
  prepare(id:string,sessionId:string,noteId:string):TaskRow {
    const existing=this.task(id)
    if(existing){if(existing.sessionId!==sessionId||existing.noteId!==noteId)throw Error('TASK_CONFLICT');return existing}
    this.db.prepare("INSERT INTO tasks VALUES(?,?,?,'notes','notes.create',NULL,NULL,'pending')").run(id,sessionId,noteId)
    return this.task(id)!
  }
  task(id:string):TaskRow|undefined {return this.db.prepare('SELECT * FROM tasks WHERE id=?').get(id) as unknown as TaskRow|undefined}
  sessionTasks(sessionId:string):TaskRow[] {return this.db.prepare("SELECT * FROM tasks WHERE sessionId=? AND app='notes' AND operation='notes.create'").all(sessionId) as unknown as TaskRow[]}
  claim(sessionId:string,callKey:string,payload:string,id:string,noteId:string):TaskRow {
    this.db.exec('BEGIN IMMEDIATE')
    try {
      let task=this.db.prepare('SELECT * FROM tasks WHERE callKey=?').get(callKey) as unknown as TaskRow|undefined
      if(task){if(task.sessionId!==sessionId||task.payload!==payload)throw Error('REQUEST_CONFLICT')}
      else {
        task=this.db.prepare("SELECT * FROM tasks WHERE sessionId=? AND callKey IS NULL AND status='pending' ORDER BY rowid LIMIT 1").get(sessionId) as unknown as TaskRow|undefined
        task??=this.prepare(id,sessionId,noteId)
        this.db.prepare('UPDATE tasks SET callKey=?,payload=? WHERE id=?').run(callKey,payload,task.id)
        task=this.task(task.id)!
      }
      this.db.exec('COMMIT');return task
    }catch(error){this.db.exec('ROLLBACK');throw error}
  }
  finish(id:string,status:'saved'|'failed'){this.db.prepare('UPDATE tasks SET status=? WHERE id=?').run(status,id)}
  close(){this.db.close()}
}
