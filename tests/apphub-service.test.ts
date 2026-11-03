import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { openAppHub } from '../src/adapter/storage/open-apphub.ts'
const caller={sessionId:'ordinary-chat',callId:'call-1',operations:['notes.create']}
const args={title:'合成测试',body:'测试正文'}
const temp=()=>mkdtempSync(join(tmpdir(),'apphub-service-'))
test('ordinary chat dispatch is controlled, deduplicated across reopen, and permits subsequent calls',()=>{
  const dir=temp();let runtime=openAppHub(dir)
  try {
    const first=runtime.service.dispatch('notes.create',args,caller)
    assert.equal(runtime.service.listNotes().length,1)
    const note=runtime.service.listNotes()[0]!
    runtime.service.saveNote({...note,body:'用户后来编辑',expectedRevision:note.revision})
    runtime.close();runtime=openAppHub(dir)
    assert.deepEqual(runtime.service.dispatch('notes.create',args,caller),first)
    assert.equal(runtime.service.listNotes()[0]?.body,'用户后来编辑')
    assert.throws(()=>runtime.service.dispatch('notes.create',{...args,body:'复用键替换内容'},caller),/CONFLICT/)
    assert.throws(()=>runtime.service.dispatch('notes.create',args,{...caller,operations:[]}),/FORBIDDEN/)
    assert.throws(()=>runtime.service.dispatch('notes.create',args,{...caller,sessionId:''}),/FORBIDDEN/)
    assert.throws(()=>runtime.service.dispatch('other.create',args,{...caller,operations:['other.create']}),/UNKNOWN/)
    assert.throws(()=>runtime.service.dispatch('notes.create',{...args,path:'/tmp/other'},caller),/INVALID/)
    runtime.service.dispatch('notes.create',args,{...caller,callId:'call-2'})
    assert.equal(runtime.service.listNotes().length,2)
  }finally{runtime.close();rmSync(dir,{recursive:true})}
})
test('AppHub prepared task uses the same operation and reconciles lost acknowledgements',()=>{
  const dir=temp();const runtime=openAppHub(dir)
  try {
    const id=crypto.randomUUID(),noteId=crypto.randomUUID()
    assert.equal(runtime.service.prepareTask(id,caller.sessionId,noteId).status,'pending')
    assert.equal(runtime.service.dispatch('notes.create',args,caller).noteId,noteId)
    assert.equal(runtime.service.getTask(id).status,'saved')
    // Simulate a lost task acknowledgement after the note committed.
    const hub=new DatabaseSync(join(dir,'hub.sqlite'));hub.prepare("UPDATE tasks SET status='pending' WHERE id=?").run(id);hub.close()
    assert.equal(runtime.service.dispatch('notes.create',args,caller).noteId,noteId)
    assert.equal(runtime.service.listNotes().length,1)
    const second=runtime.service.dispatch('notes.create',{title:'第二张',body:'独立内容'},{...caller,callId:'call-2'})
    assert.notEqual(second.noteId,noteId)
    assert.equal(runtime.service.listNotes().length,2)
    assert.throws(()=>runtime.service.prepareTask(id,'forged-session',noteId),/CONFLICT/)
  }finally{runtime.close();rmSync(dir,{recursive:true})}
})
for(const version of [1,2,3])test(`legacy v${version} migrates without modifying source and does not repeat`,()=>{
  const dir=temp(),legacy=join(dir,'notes.sqlite'),noteId=crypto.randomUUID(),taskId=crypto.randomUUID()
  const old=new DatabaseSync(legacy)
  old.exec(`CREATE TABLE notes(id TEXT PRIMARY KEY,title TEXT,body TEXT,revision INTEGER,createdAt TEXT,updatedAt TEXT); PRAGMA user_version=${version}`)
  old.prepare('INSERT INTO notes VALUES(?,?,?,?,?,?)').run(noteId,'旧便签','原正文Ωß',7,'2026-11-03','2026-11-03')
  if(version>=2)old.exec("ALTER TABLE notes ADD COLUMN color TEXT DEFAULT 'sage'")
  if(version>=3)old.exec('ALTER TABLE notes ADD COLUMN pinned INTEGER DEFAULT 1; ALTER TABLE notes ADD COLUMN archived INTEGER DEFAULT 1')
  old.exec('CREATE TABLE preferences(key TEXT PRIMARY KEY,value TEXT); CREATE TABLE note_tasks(id TEXT PRIMARY KEY,sessionId TEXT,noteId TEXT)')
  old.prepare('INSERT INTO preferences VALUES(?,?)').run('hub',JSON.stringify({appearance:'light',revision:4}))
  old.prepare('INSERT INTO preferences VALUES(?,?)').run('notes',JSON.stringify({appearance:'dark',revision:8}))
  old.prepare('INSERT INTO note_tasks VALUES(?,?,?)').run(taskId,'legacy-chat',noteId);old.close()
  const before=readFileSync(legacy);let runtime=openAppHub(dir)
  try {
    assert.equal(runtime.notesError,undefined)
    assert.equal(runtime.service.listNotes()[0]?.body,'原正文Ωß')
    assert.equal(runtime.service.listNotes()[0]?.revision,7)
    assert.equal(runtime.service.settings('hub').appearance,'light')
    assert.equal(runtime.service.settings('notes').appearance,'dark')
    assert.equal(runtime.service.getTask(taskId).status,'saved')
    runtime.service.saveSettings('notes',{appearance:'host',revision:8})
    runtime.close();runtime=openAppHub(dir)
    assert.equal(runtime.notesError,undefined)
    assert.equal(runtime.service.listNotes().length,1)
    assert.equal(runtime.service.settings('notes').appearance,'host')
    assert.equal(runtime.service.settings('hub').appearance,'light')
    assert.deepEqual(readFileSync(legacy),before)
    const notes=new DatabaseSync(join(dir,'apps/notes/data.sqlite'))
    assert.equal(notes.prepare("SELECT name FROM sqlite_master WHERE name='tasks' OR name='note_tasks'").get(),undefined)
    assert.equal(notes.prepare("SELECT * FROM preferences WHERE key='hub'").get(),undefined);notes.close()
  }finally{runtime.close();rmSync(dir,{recursive:true})}
})
test('failed app load does not prevent hub home or hub settings',()=>{
  const dir=temp();mkdirSync(join(dir,'apps/notes'),{recursive:true});writeFileSync(join(dir,'apps/notes/data.sqlite'),'broken database')
  const runtime=openAppHub(dir)
  try {
    assert.ok(runtime.notesError)
    assert.equal(runtime.service.read(crypto.randomUUID()).apps[0]?.id,'notes')
    assert.equal(runtime.service.saveSettings('hub',{appearance:'dark',revision:0}).status,'saved')
    assert.throws(()=>runtime.service.listNotes(),/UNAVAILABLE/)
    assert.equal(runtime.service.saveNote({id:crypto.randomUUID(),...args,expectedRevision:0}).status,'unavailable')
  }finally{runtime.close();rmSync(dir,{recursive:true})}
})
test('two service clients see the same data and stale versions cannot overwrite',()=>{
  const dir=temp();const a=openAppHub(dir),b=openAppHub(dir)
  try {
    const result=a.service.dispatch('notes.create',args,caller),note=b.service.listNotes()[0]!
    assert.equal(note.id,result.noteId)
    assert.equal(a.service.saveNote({...note,body:'窗口 A',expectedRevision:note.revision}).status,'saved')
    assert.equal(b.service.saveNote({...note,body:'窗口 B',expectedRevision:note.revision}).status,'conflict')
    assert.equal(b.service.listNotes()[0]?.body,'窗口 A')
  }finally{b.close();a.close();rmSync(dir,{recursive:true})}
})
test('migration failure rolls back copied notes and can resume after source repair',()=>{
  const dir=temp(),legacy=join(dir,'notes.sqlite'),id=crypto.randomUUID()
  const db=new DatabaseSync(legacy)
  db.exec('CREATE TABLE notes(id TEXT PRIMARY KEY,title TEXT,body TEXT,revision INTEGER,createdAt TEXT,updatedAt TEXT); PRAGMA user_version=1; CREATE TABLE preferences(key TEXT,value TEXT)')
  db.prepare('INSERT INTO notes VALUES(?,?,?,?,?,?)').run(id,'测试','不丢失',1,'2026-11-03','2026-11-03')
  // Duplicate settings make migration fail after notes have been copied.
  db.prepare('INSERT INTO preferences VALUES(?,?)').run('hub','{}');db.prepare('INSERT INTO preferences VALUES(?,?)').run('hub','{}');db.close()
  let runtime=openAppHub(dir)
  try {
    assert.ok(runtime.notesError)
    const target=new DatabaseSync(join(dir,'apps/notes/data.sqlite'))
    assert.equal(target.prepare('SELECT count(*) AS n FROM notes').get()!.n,0);target.close()
    runtime.close()
    const repair=new DatabaseSync(legacy);repair.exec('DELETE FROM preferences');repair.close()
    runtime=openAppHub(dir)
    assert.equal(runtime.notesError,undefined)
    assert.equal(runtime.service.listNotes()[0]?.body,'不丢失')
  }finally{runtime.close();rmSync(dir,{recursive:true})}
})
test('session task summary distinguishes partial saves',()=>{
 const dir=temp(),runtime=openAppHub(dir)
 try{
  const id=crypto.randomUUID(),noteId=crypto.randomUUID()
  runtime.service.prepareTask(id,caller.sessionId,noteId)
  runtime.service.dispatch('notes.create',args,caller)
  const second=crypto.randomUUID();runtime.service.prepareTask(second,caller.sessionId,crypto.randomUUID())
  const hub=new DatabaseSync(join(dir,'hub.sqlite'))
  hub.prepare("UPDATE tasks SET status='failed' WHERE id=?").run(second);hub.close()
  const summary=runtime.service.getTask(id)
  assert.equal(summary.status,'partial');assert.equal(summary.savedCount,1);assert.equal(summary.failedCount,1)
  assert.equal(summary.pendingCount,0)
 }finally{runtime.close();rmSync(dir,{recursive:true})}
})
