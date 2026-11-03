import { existsSync } from 'node:fs'
import type { HubRepository } from './hub-sqlite.ts'
// Called only at startup, before opening either app service. Keep the legacy file untouched.
export function migrateLegacy(hub:HubRepository,legacy:string,notesPath:string) {
  const db=hub.db
  if(db.prepare("SELECT id FROM migrations WHERE id='split-notes-v1'").get())return
  if(!existsSync(legacy)){db.exec("INSERT INTO migrations VALUES('split-notes-v1')");return}
  db.prepare('ATTACH DATABASE ? AS legacy').run(legacy)
  db.prepare('ATTACH DATABASE ? AS notes_app').run(notesPath)
  try {
    const version=Number(db.prepare('PRAGMA legacy.user_version').get()!.user_version)
    if(![1,2,3].includes(version))throw Error('Unsupported legacy schema')
    db.exec('BEGIN IMMEDIATE')
    try {
      if(Number(db.prepare('SELECT count(*) AS n FROM notes_app.notes').get()!.n)||Number(db.prepare('SELECT count(*) AS n FROM tasks').get()!.n))throw Error('Migration targets are not empty')
      const columns=`id,title,body,revision,createdAt,updatedAt,${version>=2?'color':"'cream' AS color"},${version>=3?'pinned,archived':'0 AS pinned,0 AS archived'}`
      db.exec(`INSERT INTO notes_app.notes SELECT ${columns} FROM legacy.notes`)
      const has=(name:string)=>!!db.prepare("SELECT name FROM legacy.sqlite_master WHERE type='table' AND name=?").get(name)
      if(has('preferences')){
        db.exec("INSERT INTO preferences SELECT * FROM legacy.preferences WHERE key='hub'; INSERT INTO notes_app.preferences SELECT * FROM legacy.preferences WHERE key='notes'")
      }
      if(has('note_tasks'))db.exec("INSERT INTO tasks SELECT id,sessionId,noteId,'notes','notes.create',NULL,NULL,CASE WHEN EXISTS(SELECT 1 FROM legacy.notes WHERE notes.id=note_tasks.noteId) THEN 'saved' ELSE 'pending' END FROM legacy.note_tasks")
      if(has('preferences')) {
        for(const [scope,target] of [['hub','main'],['notes','notes_app']]) {
          if(db.prepare(`SELECT * FROM legacy.preferences WHERE key=? EXCEPT SELECT * FROM ${target}.preferences WHERE key=?`).get(scope!,scope!))throw Error('Settings migration verification failed')
        }
      }
      if(has('note_tasks')&&db.prepare('SELECT id,sessionId,noteId FROM legacy.note_tasks EXCEPT SELECT id,sessionId,noteId FROM tasks').get())throw Error('Task migration verification failed')
      // Compare every copied field, not only row counts, before marking the split complete.
      const mismatch=db.prepare(`SELECT count(*) AS n FROM (SELECT ${columns} FROM legacy.notes EXCEPT SELECT * FROM notes_app.notes)`).get()!
      if(Number(mismatch.n))throw Error('Migration verification failed')
      db.exec("INSERT INTO migrations VALUES('split-notes-v1'); COMMIT")
    }catch(error){db.exec('ROLLBACK');throw error}
  }finally{db.exec('DETACH DATABASE notes_app; DETACH DATABASE legacy')}
}
