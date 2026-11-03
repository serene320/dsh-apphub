import {test} from 'node:test'
import assert from 'node:assert/strict'
import {formatBookmarks,collectBookmarkExport} from '../src/application/bookmark-export.ts'
import {parseBookmarkHtml} from '../src/adapter/host/bookmark-import.ts'
import type {Bookmark} from '../src/contracts.ts'
const item:Bookmark={id:'x',url:'https://example.com/?a=1&b=2',title:'<工具> & "说明"',description:'个人备注',tags:['开发'],collections:['工具 / 开发'],revision:1,createdAt:'2026-11-03',updatedAt:'2026-11-03',deletedAt:null,source:'manual',aiSummary:'AI',sources:['https://example.com'],preview:{status:'ready',title:'',description:'',image:'private-cache',icon:'',error:'',checkedAt:''}}
test('exports full matching range beyond loaded page, without silent truncation',()=>{
 const values=Array.from({length:125},(_,i)=>({...item,id:String(i)})),offsets:number[]=[]
 assert.equal(collectBookmarkExport(offset=>{offsets.push(offset);return {items:values.slice(offset,offset+60),total:125}}).length,125)
 assert.deepEqual(offsets,[0,60,120]);assert.throws(()=>collectBookmarkExport(()=>({items:[],total:10001})))
})
test('JSON preserves business fields but excludes media cache and deleted rows',()=>{
 const result=JSON.parse(formatBookmarks([item,{...item,deletedAt:'today'}],'json').text)
 assert.equal(result.bookmarks.length,1);assert.equal(result.bookmarks[0].description,'个人备注');assert.equal(result.bookmarks[0].preview,undefined)
})
test('HTML escapes content and roundtrips browser folder hierarchy',()=>{
 const file=formatBookmarks([item],'html');assert.ok(!file.text.includes('<工具>'))
 const parsed=parseBookmarkHtml(file.text);assert.equal(parsed.items[0]?.url,item.url);assert.equal(parsed.items[0]?.title,item.title);assert.deepEqual(parsed.items[0]?.collections,item.collections)
})
test('Markdown preserves links, notes, labels and sources',()=>{
 const file=formatBookmarks([item],'markdown');assert.ok(file.text.includes(item.url));assert.ok(file.text.includes('个人备注'));assert.ok(file.text.includes('开发'));assert.ok(!file.text.includes('private-cache'))
})

test('new session handoff uses a scoped file receipt and waits for acceptance before navigation',async()=>{
 const {bookmarkExporter}=await import('../src/adapter/client/bookmark-export.ts')
 const calls:string[]=[],requests:unknown[]=[]
 const session={beginSubmission:()=>({requestId:'request-1'}),prompt:async(content:unknown)=>{calls.push('prompt');requests.push(content);return {ok:true}}}
 const ctx={remote:{apphub:{exportBookmarks:async()=>({ok:true,value:formatBookmarks([item],'json')})}},sessions:{create:async()=>{calls.push('create');return 'session-1'},retain:()=>({ready:Promise.resolve({session}),release:()=>calls.push('release')})},fileUpload:{upload:async(id:string,data:Blob)=>{assert.equal(id,'session-1');assert.equal(JSON.parse(await data.text()).bookmarks.length,1);calls.push('upload');return {ok:true,value:{file:{},receiptId:'receipt-1'}}}},uiWorkspace:{openSession:()=>calls.push('open')}}
 assert.equal(await bookmarkExporter(ctx as never)('','工具','session','整理链接'),true)
 assert.deepEqual(calls,['create','upload','prompt','open','release'])
 assert.deepEqual((requests[0] as {type:string;receiptId?:string}[])[1],{type:'file',receiptId:'receipt-1'})
 calls.length=0;ctx.fileUpload.upload=async()=>{throw Error('上传失败')}
 await assert.rejects(()=>bookmarkExporter(ctx as never)('','','session','整理链接'),/上传失败/)
 assert.deepEqual(calls,['create','release'])
})
