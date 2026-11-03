import {test} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {SqliteBookmarksRepository} from '../src/adapter/storage/bookmarks-sqlite.ts'
import {createBookmarksService,bookmarkUrl} from '../src/application/bookmarks.ts'
import {parseBookmarkHtml} from '../src/adapter/host/bookmark-import.ts'
import {createBookmarksController} from '../src/application/bookmarks-controller.ts'
const html=`<!DOCTYPE NETSCAPE-Bookmark-file-1><META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8"><TITLE>Bookmarks</TITLE><H1>Bookmarks</H1><DL><p><DT><H3>书签栏</H3><DL><p><DT><H3>开发</H3><DL><p><DT><A HREF="https://example.com/?a=1&amp;b=2">示例 &amp; 文档</A></DL><p><DT><A HREF="https://github.com/serene320/dsh-apphub">AppHub</A><DT><A HREF="javascript:alert(1)">危险</A></DL><p></DL><p>`
test('Chrome HTML parses nested folders and entities without accepting script URLs',()=>{
 const preview=parseBookmarkHtml(html);assert.equal(preview.items.length,2);assert.equal(preview.skipped,1)
 assert.deepEqual(preview.items[0],{url:'https://example.com/?a=1&b=2',title:'示例 & 文档',collections:['书签栏 / 开发']})
 assert.deepEqual(preview.items[1]?.collections,['书签栏']);assert.throws(()=>parseBookmarkHtml('<html>not bookmarks</html>'))
 assert.throws(()=>bookmarkUrl('file:///etc/passwd'));assert.throws(()=>bookmarkUrl('https://user:pass@example.com'))
 assert.notEqual(bookmarkUrl('https://example.com/#a'),bookmarkUrl('https://example.com/#b'))
})
test('bookmarks persist, reject stale writes, deduplicate imports and preserve manual fields and deletion',()=>{
 const dir=mkdtempSync(join(tmpdir(),'apphub-bookmarks-')),file=join(dir,'data.sqlite');let repository=new SqliteBookmarksRepository(file)
 try{let service=createBookmarksService(repository);const input={id:randomUUID(),url:'https://example.com/?a=1&b=2',title:'人工标题',description:'自己的说明',tags:['参考'],collections:['个人'],expectedRevision:0}
 const first=service.save(input);assert.equal(first.status,'saved');assert.equal(service.save(input).status,'saved')
 const preview=parseBookmarkHtml(html);assert.deepEqual(service.importItems(preview.items),{added:1,duplicates:1,skipped:0});assert.equal(service.list().length,2)
 const existing=service.list().find(b=>b.id===input.id)!;assert.equal(existing.title,'人工标题');assert.deepEqual(existing.tags,['参考']);assert.deepEqual(existing.collections,['个人','书签栏 / 开发'])
 assert.equal(service.save({...input,title:'旧版本'}).status,'conflict');assert.equal(service.save({...input,id:randomUUID()}).status,'duplicate')
 assert.equal(service.remove(existing.id,existing.revision),true);assert.equal(service.importItems(preview.items).added,0);assert.equal(service.list().length,1)
 repository.close();repository=new SqliteBookmarksRepository(file);service=createBookmarksService(repository);assert.equal(service.list().length,1)
 assert.equal(service.save({...input,id:randomUUID()}).status,'saved');assert.equal(service.list().length,2)
 const before=service.list();assert.throws(()=>service.importItems([{url:'javascript:bad',title:'bad',collections:[]}])) ;assert.deepEqual(service.list(),before)
 }finally{repository.close();rmSync(dir,{recursive:true,force:true})}
})
test('failed bookmark save keeps items; import failure keeps preview for retry',async()=>{
 let fail=true
 const controller=createBookmarksController({list:async()=>[],save:async()=>{throw Error('save failed')},remove:async()=>false,preview:async()=>parseBookmarkHtml(html),importHtml:async()=>{if(fail)throw Error('import failed');return {added:2,duplicates:0,skipped:1}}})
 await controller.load();assert.equal(await controller.save({id:randomUUID(),url:'https://example.com',title:'test',description:'',tags:[],collections:[],expectedRevision:0}),undefined);assert.deepEqual(controller.getSnapshot().items,[]);assert.match(controller.getSnapshot().error,/save failed/);await controller.preview(html);await controller.importHtml();assert.ok(controller.getSnapshot().importPreview);assert.match(controller.getSnapshot().error,/import failed/)
 fail=false;await controller.importHtml();assert.equal(controller.getSnapshot().importResult?.added,2);assert.equal(controller.getSnapshot().importPreview,null);controller.dispose()
})

test('AI batches are authorized, replay-safe, preserve user fields and organize with revision checks',()=>{
 const dir=mkdtempSync(join(tmpdir(),'apphub-ai-')),repo=new SqliteBookmarksRepository(join(dir,'db'))
 try{
  const service=createBookmarksService(repo),caller={sessionId:'chat',callId:'one',operations:['bookmarks.create','bookmarks.organize']}
  const item={url:'https://example.com/a',title:'Example',summary:'AI用途',tags:['文档'],collections:['参考'],sources:['https://example.com']}
  assert.throws(()=>service.dispatch('bookmarks.create',{items:[item]},{...caller,operations:[]}),/FORBIDDEN/)
  const first=service.dispatch('bookmarks.create',{items:[item]},caller)
  assert.equal(first.results[0]?.status,'created');assert.deepEqual(service.dispatch('bookmarks.create',{items:[item]},caller),first)
  assert.throws(()=>service.dispatch('bookmarks.create',{items:[{...item,title:'different'}]},caller),/REQUEST_CONFLICT/)
  const b=service.list()[0]!
  service.save({...b,title:'个人标题',description:'个人备注',expectedRevision:b.revision})
  assert.equal(service.dispatch('bookmarks.create',{items:[item]},{...caller,callId:'two'}).results[0]?.status,'existing')
  assert.equal(service.list()[0]?.title,'个人标题');assert.equal(service.list()[0]?.aiSummary,'AI用途')
  const current=service.list()[0]!
  assert.equal(service.dispatch('bookmarks.organize',{id:current.id,revision:current.revision,tags:['开发'],collections:['OpenAI']},{...caller,callId:'three'}).results[0]?.status,'updated')
  assert.equal(service.list()[0]?.description,'个人备注')
  assert.equal(service.dispatch('bookmarks.organize',{id:current.id,revision:current.revision,tags:[],collections:[]},{...caller,callId:'four'}).results[0]?.status,'failed')
  assert.deepEqual(service.summary('chat'),{savedCount:2,existingCount:1,failedCount:1,createdCount:1,updatedCount:1})
  assert.throws(()=>service.dispatch('bookmarks.create',{items:Array(21).fill(item)},{...caller,callId:'large'}));assert.equal(service.summary('chat').failedCount,2)
 }finally{repo.close();rmSync(dir,{recursive:true,force:true})}
})

test('10000 bookmarks paginate and filter without sending the full collection to the page',()=>{
 const dir=mkdtempSync(join(tmpdir(),'apphub-many-')),repo=new SqliteBookmarksRepository(join(dir,'db'))
 try{
  const service=createBookmarksService(repo)
  service.importItems(Array.from({length:10000},(_,i)=>({url:`https://example.com/${i}`,title:`文档 ${i}`,collections:[i%2?'开发':'日常']})))
  const a=service.page('','',0),b=service.page('','',60)
  assert.equal(a.total,10000);assert.equal(a.items.length,60);assert.equal(b.items.length,60)
  assert.equal(new Set([...a.items,...b.items].map(x=>x.id)).size,120)
  assert.equal(service.page('','开发',0).total,5000)
  assert.equal(service.page('文档 9999','',0).items.length,1)
  assert.throws(()=>service.page('','',0,10000))
 }finally{repo.close();rmSync(dir,{recursive:true,force:true})}
})

test('infinite loading appends once, refreshes loaded range, and ignores an old filter response',async()=>{
 const rows=Array.from({length:125},(_,i)=>({id:String(i),title:String(i),preview:{status:'ready',checkedAt:new Date().toISOString()}}))
 let calls:number[]=[],release:(()=>void)|undefined,blocked=false
 const controller=createBookmarksController({query:async(q:string,_c:string,offset:number)=>{calls.push(offset);if(blocked&&offset===60)await new Promise<void>(r=>{release=r});return {items:q?[rows[124]]:rows.slice(offset,offset+60),total:q?1:125,collections:[]}}} as any)
 try{
  await controller.load();assert.equal(controller.getSnapshot().items.length,60)
  blocked=true;const pending=controller.loadMore();await controller.loadMore();assert.deepEqual(calls,[0,60]);release!();await pending;blocked=false
  assert.equal(controller.getSnapshot().items.length,120)
  await controller.load();assert.equal(controller.getSnapshot().items.length,120)
  await controller.loadMore();assert.equal(controller.getSnapshot().items.length,125)
  const before=calls.length;await controller.loadMore();assert.equal(calls.length,before)
  controller.filter('','');await controller.load();blocked=true;const old=controller.loadMore()
  controller.filter('new','');await controller.load();release!();await old
  assert.deepEqual(controller.getSnapshot().items.map(b=>b.id),['124']);assert.equal(controller.getSnapshot().loadingMore,false)
 }finally{controller.dispose()}
})

test('next batch failure preserves loaded bookmarks and explicit reload allows retry',async()=>{
 let fail=true
 const rows=Array.from({length:61},(_,i)=>({id:String(i),preview:{status:'ready',checkedAt:new Date().toISOString()}}))
 const controller=createBookmarksController({query:async(_q:string,_c:string,offset:number)=>{if(offset&&fail)throw Error('offline');return {items:rows.slice(offset,offset+60),total:61,collections:[]}}} as any)
 try{await controller.load();await controller.loadMore();assert.equal(controller.getSnapshot().items.length,60);assert.equal(controller.getSnapshot().error,'offline');assert.equal(controller.getSnapshot().loadingMore,false)
 fail=false;await controller.load();await controller.loadMore();assert.equal(controller.getSnapshot().items.length,61)
 }finally{controller.dispose()}
})

test('search keeps current results during debounce then replaces them without stale actions',async()=>{
 const rows=[{id:'old',preview:{status:'ready',checkedAt:new Date().toISOString()}}]
 const controller=createBookmarksController({query:async(q:string)=>({items:q?[]:rows,total:q?0:1,collections:[]})} as any)
 try{await controller.load();controller.filter('missing','');assert.equal(controller.getSnapshot().loaded,true);assert.equal(controller.getSnapshot().loading,true);assert.equal(controller.getSnapshot().items[0]?.id,'old')
 await controller.load();assert.equal(controller.getSnapshot().loading,false);assert.deepEqual(controller.getSnapshot().items,[])
 }finally{controller.dispose()}
})
