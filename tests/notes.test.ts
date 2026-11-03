import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SqliteNotesRepository } from '../src/adapter/storage/notes-sqlite.ts'
import { createNotesService } from '../src/application/notes.ts'
import { createNotesController } from '../src/application/notes-controller.ts'

test('notes persist across reopen, retry is idempotent, stale write is rejected', () => {
  const dir = mkdtempSync(join(tmpdir(), 'apphub-notes-'))
  const path = join(dir, 'notes.sqlite')
  let repository = new SqliteNotesRepository(path)
  try {
    const service = createNotesService(repository)
    const input = { id: crypto.randomUUID(), title: '想法', body: '中文\n第二行', expectedRevision: 0 }
    const first = service.save(input)
    assert.equal(first.status, 'saved')
    assert.deepEqual(service.save(input), first)
    assert.equal(service.save({ ...input, body: '旧版本覆盖' }).status, 'conflict')
    assert.equal(service.save({ ...input, expectedRevision: 1, body: '修改后的内容' }).status, 'saved')
    repository.close(); repository = new SqliteNotesRepository(path)
    assert.equal(repository.list()[0]?.body, '修改后的内容')
    assert.equal(repository.list()[0]?.revision, 2)
    assert.equal(repository.list().length, 1)
  } finally { repository.close(); rmSync(dir, { recursive: true }) }
})

test('controller preserves drafts on failed save, blocks switching, retries successfully', async () => {
  let fail = true
  const controller = createNotesController({ list: async () => [], save: async input => {
    if (fail) throw new Error('offline')
    return { status: 'saved', note: { id: input.id, title: input.title, body: input.body, revision: 1, createdAt: '2026-11-03T00:00:00Z', updatedAt: '2026-11-03T00:00:00Z' } }
  } })
  await controller.load(); controller.create(); controller.edit('body', '不要丢失')
  const id = controller.getSnapshot().draft?.id
  await controller.save()
  assert.equal(controller.getSnapshot().dirty, true)
  assert.equal(controller.getSnapshot().saveFailed, true)
  assert.equal(controller.getSnapshot().draft?.body, '不要丢失')
  controller.create(); assert.equal(controller.getSnapshot().draft?.id, id)
  fail = false; await controller.save()
  assert.equal(controller.getSnapshot().dirty, false)
  assert.equal(controller.getSnapshot().saveFailed, false)
  assert.equal(controller.getSnapshot().notes.length, 1)
  controller.dispose()
})

test('business validation rejects empty content and oversized title before storage', () => {
  const service = createNotesService({ list: () => [], save: () => { throw Error('must not write') } })
  const input = { id: crypto.randomUUID(), title: '', body: '', expectedRevision: 0 }
  assert.equal(service.save(input).status, 'invalid')
  assert.equal(service.save({ ...input, title: 'x'.repeat(201) }).status, 'invalid')
})

test('typing during save preserves newer text and advances its revision',async()=>{
  let complete!: (value:any)=>void
  const notes=createNotesController({list:async()=>[],save:input=>new Promise(resolve=>{complete=value=>resolve({status:'saved',note:{...input,revision:1,createdAt:'2026-11-03',updatedAt:'2026-11-03',...value}})})})
  await notes.load();notes.create();notes.edit('body','first')
  const pending=notes.save();notes.edit('body','newer');complete({});await pending
  assert.equal(notes.getSnapshot().draft?.body,'newer')
  assert.equal(notes.getSnapshot().draft?.expectedRevision,1)
  assert.equal(notes.getSnapshot().dirty,true)
  notes.dispose()
})

test('archive, restore, pin and paper color persist through the same versioned save',()=>{
  const dir=mkdtempSync(join(tmpdir(),'apphub-flags-')),path=join(dir,'notes.sqlite')
  const repo=new SqliteNotesRepository(path)
  try {
    const service=createNotesService(repo),base={id:crypto.randomUUID(),title:'测试便签',body:'保留正文',color:'sage',expectedRevision:0}
    assert.equal(service.save(base).status,'saved')
    assert.equal(service.save({...base,pinned:true,archived:true,expectedRevision:1}).status,'saved')
    assert.equal(repo.list()[0]?.archived,true);assert.equal(repo.list()[0]?.pinned,true)
    assert.equal(service.save({...base,pinned:true,archived:false,expectedRevision:2}).status,'saved')
    assert.equal(repo.list()[0]?.archived,false);assert.equal(repo.list()[0]?.body,'保留正文')
    repo.saveSettings({appearance:'light',revision:0})
    assert.equal(repo.settings().appearance,'light')
  }finally{repo.close();rmSync(dir,{recursive:true})}
})

test('archived and pinned flags survive selection, content edit, reload and restore',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'apphub-archive-flow-'))
  const repo=new SqliteNotesRepository(join(dir,'notes.sqlite'))
  const id=crypto.randomUUID()
  const controller=createNotesController({list:async()=>repo.list(),save:async input=>repo.save(input)})
  try {
    repo.save({id,title:'归档回归',body:'原文',pinned:true,archived:false,color:'rose',expectedRevision:0})
    await controller.load();assert.equal(controller.select(id),true)
    assert.equal(controller.getSnapshot().draft?.pinned,true)
    assert.equal(await controller.setArchived(true),true)
    assert.equal(controller.close(),true)
    await controller.load();controller.select(id)
    assert.equal(controller.getSnapshot().draft?.archived,true)
    assert.equal(controller.getSnapshot().draft?.pinned,true)
    controller.edit('body','归档后编辑');await controller.save()
    assert.equal(repo.list()[0]?.archived,true)
    assert.equal(await controller.setArchived(false),true)
    controller.close();await controller.load();controller.select(id)
    assert.equal(controller.getSnapshot().draft?.archived,false)
    assert.equal(controller.getSnapshot().draft?.pinned,true)
    assert.equal(controller.getSnapshot().draft?.body,'归档后编辑')
  }finally{controller.dispose();repo.close();rmSync(dir,{recursive:true})}
})

test('failed archive leaves category and draft intact, retry commits once',async()=>{
  const note={id:crypto.randomUUID(),title:'失败回归',body:'原文',pinned:true,archived:false,color:'sage',revision:1,createdAt:'2026-11-03',updatedAt:'2026-11-03'}
  let fail=true
  const controller=createNotesController({list:async()=>[note],save:async input=>{if(fail)throw Error('offline');return {status:'saved',note:{...note,...input,revision:2}}}})
  await controller.load();controller.select(note.id)
  assert.equal(await controller.setArchived(true),false)
  assert.equal(controller.getSnapshot().draft?.archived,false)
  assert.equal(controller.getSnapshot().notes[0]?.archived,false)
  assert.equal(controller.getSnapshot().draft?.body,'原文')
  fail=false;assert.equal(await controller.setArchived(true),true)
  assert.equal(controller.getSnapshot().draft?.archived,true)
  assert.equal(controller.getSnapshot().notes[0]?.revision,2)
  controller.dispose()
})

test('closing a new empty note discards appearance-only edits without a save',async()=>{
  let writes=0
  const controller=createNotesController({list:async()=>[],save:async()=>{writes++;return {status:'invalid'}}})
  await controller.load();controller.create();controller.edit('color','rose')
  assert.equal(await controller.closeEditor(),true)
  assert.equal(writes,0);assert.equal(controller.getSnapshot().draft,undefined)
  assert.equal(controller.getSnapshot().dirty,false);assert.equal(controller.getSnapshot().saveFailed,false)
  controller.create();controller.edit('body','   ')
  assert.equal(await controller.closeEditor(),true);assert.equal(writes,0)
  controller.dispose()
})

test('closing never discards a failed nonempty draft or an emptied existing note',async()=>{
  const note={id:crypto.randomUUID(),title:'既有',body:'正文',revision:1,createdAt:'2026-11-03',updatedAt:'2026-11-03'}
  const controller=createNotesController({list:async()=>[note],save:async()=>({status:'unavailable'})})
  await controller.load();controller.select(note.id);controller.edit('title','');controller.edit('body','')
  assert.equal(await controller.closeEditor(),false);assert.equal(controller.getSnapshot().draft?.id,note.id)
  controller.dispose()
  const fresh=createNotesController({list:async()=>[],save:async()=>({status:'unavailable'})})
  await fresh.load();fresh.create();fresh.edit('body','尚未保存的正文')
  assert.equal(await fresh.closeEditor(),false);assert.equal(fresh.getSnapshot().draft?.body,'尚未保存的正文')
  fresh.dispose()
})
