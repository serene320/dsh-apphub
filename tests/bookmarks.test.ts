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
