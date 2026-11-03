import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createNotesController} from '../src/application/notes-controller.ts'
import {createDraftJournal} from '../src/adapter/client/draft-journal.ts'
import type {Note,SaveNote} from '../src/contracts.ts'
function storage(){const data=new Map<string,string>();return {get length(){return data.size},key:(i:number)=>[...data.keys()][i]??null,getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v)},removeItem:(k:string)=>{data.delete(k)},clear:()=>data.clear()} as Storage}
const saved=(draft:SaveNote):Note=>({...draft,revision:1,createdAt:'2026-11-03',updatedAt:'2026-11-03'})
test('unacknowledged edit survives disposal, restores without opening itself and clears only after save',async()=>{
 const disk=storage(),journal=createDraftJournal(disk);let rows:Note[]=[]
 const port={list:async()=>rows,save:async(d:SaveNote)=>{const note=saved(d);rows=[note];return {status:'saved' as const,note}}}
 const first=createNotesController(port,journal);await first.load();first.create();first.edit('body','最后一笔草稿')
 const id=first.getSnapshot().draft!.id
 assert.equal(journal.list()[0]?.body,'最后一笔草稿')
 first.dispose()
 const reopened=createNotesController(port,journal);await reopened.load()
 assert.equal(reopened.getSnapshot().draft,undefined)
 assert.equal(reopened.getSnapshot().recoverable.length,1)
 assert.equal(reopened.restore(id),true)
 await reopened.save()
 assert.equal(rows[0]?.body,'最后一笔草稿');assert.equal(journal.list().length,0)
 reopened.dispose()
})
test('lost save acknowledgement reconciles identical content; stale recovery never overwrites newer notes',async()=>{
 const journal=createDraftJournal(storage()),id=crypto.randomUUID()
 const draft:SaveNote={id,title:'旧标题',body:'未确认正文',color:'cream',expectedRevision:0}
 journal.write(draft)
 const note=saved(draft)
 const same=createNotesController({list:async()=>[note],save:async()=>({status:'unavailable'})},journal)
 await same.load();assert.equal(same.getSnapshot().recoverable.length,0);assert.equal(journal.list().length,0);same.dispose()
 journal.write(draft)
 const newer={...note,body:'更新的正文',revision:3}
 let copy:SaveNote|undefined
 const conflict=createNotesController({list:async()=>[newer],save:async(input)=>{copy=input;return {status:'saved',note:saved(input)}}},journal)
 await conflict.load();conflict.restore(id)
 assert.notEqual(conflict.getSnapshot().draft?.id,id)
 assert.equal(await conflict.save(),true);assert.equal(copy?.expectedRevision,0)
 assert.equal(copy?.body,'未确认正文');assert.equal(newer.body,'更新的正文');assert.equal(journal.list().length,0);conflict.dispose()
})
test('refresh failure preserves rows and publishes a retryable load error',async()=>{
 let fail=false
 const note=saved({id:crypto.randomUUID(),title:'既有便签',body:'正文',expectedRevision:0})
 const c=createNotesController({list:async()=>{if(fail)throw Error('offline');return [note]},save:async()=>({status:'unavailable'})})
 await c.load();fail=true;await c.load()
 assert.equal(c.getSnapshot().loaded,true);assert.equal(c.getSnapshot().notes.length,1);assert.ok(c.getSnapshot().loadError)
 fail=false;await c.load();assert.equal(c.getSnapshot().loadError,'');c.dispose()
})
test('journal storage failure preserves editable draft and exposes protection failure',async()=>{
 const c=createNotesController({list:async()=>[],save:async()=>({status:'unavailable'})},{list:()=>[],write:()=>{throw Error('quota')},remove:()=>{}})
 await c.load();c.create();c.edit('body','正文仍在')
 assert.equal(c.getSnapshot().draft?.body,'正文仍在');assert.ok(c.getSnapshot().recoveryError);c.dispose()
})
