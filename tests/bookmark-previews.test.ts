import {test} from 'node:test'
import assert from 'node:assert/strict'
import {extractPreview,publicImageAddress,fetchPublicImage} from '../src/adapter/host/bookmark-previews.ts'
test('preview extracts inert metadata and resolves relative images without executing HTML',()=>{
 const p=extractPreview('<title>Fallback</title><meta property="og:title" content="Site"><meta property="og:image" content="/cover.png"><meta name="description" content="Description"><link rel="icon" href="javascript:bad"><script>throw 1</script>','https://example.com/docs')
 assert.deepEqual(p,{title:'Site',description:'Description',image:'https://example.com/cover.png',icon:''})
})
test('image fetch rejects private, loopback, fake-IP and translation addresses',async()=>{
 for(const ip of ['127.0.0.1','10.0.0.1','192.168.1.1','169.254.169.254','198.18.0.178','::1','::ffff:127.0.0.1','64:ff9b::7f00:1'])assert.equal(publicImageAddress(ip),false)
 assert.equal(publicImageAddress('8.8.8.8'),true)
 await assert.rejects(fetchPublicImage('http://127.0.0.1/x',AbortSignal.timeout(1000)),/公网/)
})

test('images reuse the official proxy route and recheck each redirect without a direct fallback',async()=>{
 const {Readable}=await import('node:stream')
 const seen:string[]=[]
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR4nGP4z8DAAMIM////ZwAAHu8E/KPItPcAAAAASUVORK5CYII=','base64')
 const route:any=(url:URL)=>({proxied:true,proxy:'not-used',dispatcher:{request:async()=>{seen.push(url.href);return {statusCode:200,headers:{'content-type':'image/png'},body:Readable.from([png])}}}})
 const result=await fetchPublicImage('https://unresolved.invalid/image',AbortSignal.timeout(1000),0,route)
 assert.equal(result.mime,'image/png');assert.deepEqual(result.body,png);assert.equal(seen.length,1)
 const redirect:any=()=>({proxied:true,proxy:'not-used',dispatcher:{request:async()=>({statusCode:302,headers:{location:'http://127.0.0.1/private'},body:Readable.from([])})}})
 await assert.rejects(fetchPublicImage('http://unresolved.invalid/image',AbortSignal.timeout(1000),0,redirect),/公网/)
 const failure:any=()=>({proxied:true,proxy:'not-used',dispatcher:{request:async()=>{throw Error('proxy failed')}}})
 await assert.rejects(fetchPublicImage('https://example.com/image',AbortSignal.timeout(1000),0,failure),/proxy failed/)
})

test('expired preview results keep refreshing until the queued result arrives',async t=>{
 const {createBookmarksController}=await import('../src/application/bookmarks-controller.ts')
 t.mock.timers.enable({apis:['setTimeout','Date'],now:Date.parse('2026-11-03T12:00:00Z')})
 let calls=0
 const controller=createBookmarksController({query:async()=>{calls++;return {items:[{id:'a',preview:{status:calls===1?'failed':'ready',checkedAt:calls===1?'2026-11-03T11:00:00Z':new Date().toISOString()}}],total:1,collections:[]}}} as any)
 await controller.load();assert.equal(calls,1)
 t.mock.timers.tick(2500);await Promise.resolve();await Promise.resolve()
 assert.equal(calls,2);assert.equal(controller.getSnapshot().items[0]?.preview?.status,'ready')
 t.mock.timers.tick(10000);assert.equal(calls,2)
 controller.dispose()
})

test('persisted previews avoid network after reopen and survive failed refresh',async()=>{
 const {mkdtempSync,rmSync}=await import('node:fs')
 const {tmpdir}=await import('node:os')
 const {join}=await import('node:path')
 const {SqliteBookmarksRepository}=await import('../src/adapter/storage/bookmarks-sqlite.ts')
 const {createBookmarksService}=await import('../src/application/bookmarks.ts')
 const {createBookmarkPreviews}=await import('../src/adapter/host/bookmark-previews.ts')
 const dir=mkdtempSync(join(tmpdir(),'apphub-preview-cache-')),file=join(dir,'data.sqlite')
 let repo=new SqliteBookmarksRepository(file),queue:ReturnType<typeof createBookmarkPreviews>|undefined
 try{
  let service=createBookmarksService(repo)
  const item=service.save({id:'7a8bb5c8-abcd-4d19-b390-616477d524cd',url:'https://example.com/',title:'Cached',description:'',tags:[],collections:[],expectedRevision:0}).bookmark!
  const preview={status:'ready' as const,title:'Cached title',description:'Cached description',image:'image-key',icon:'',error:'',checkedAt:new Date().toISOString()}
  repo.putMedia('image-key','image/png',Buffer.from('cached image'));service.preview(item.id,item.url,preview)
  repo.close();repo=new SqliteBookmarksRepository(file);service=createBookmarksService(repo)
  let calls=0
  queue=createBookmarkPreviews(service,repo,()=>({fetch:async()=>{calls++;throw Error('offline')}}))
  queue.enqueue([item.id]);await new Promise<void>(r=>setImmediate(r))
  assert.equal(calls,0);assert.equal(Buffer.from(repo.media('image-key')!.body).toString(),'cached image')
  service.preview(item.id,item.url,{...preview,checkedAt:'1970-01-01T00:00:00.000Z'})
  queue.enqueue([item.id]);await new Promise<void>(r=>setImmediate(r))
  const cached=service.find(item.id)!.preview!
  assert.equal(calls,1);assert.equal(cached.status,'failed');assert.equal(cached.image,'image-key');assert.equal(cached.title,'Cached title')
  queue.enqueue([item.id]);await new Promise<void>(r=>setImmediate(r));assert.equal(calls,1)
 }finally{queue?.dispose();repo.close();rmSync(dir,{recursive:true,force:true})}
})
