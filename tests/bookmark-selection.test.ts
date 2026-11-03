import {test} from 'node:test'
import assert from 'node:assert/strict'
import {toggleBookmarkSelection,selectedBookmarkUrls} from '../src/application/bookmark-selection.ts'
import {openBookmarks} from '../src/adapter/client/bookmark-files.ts'
test('multi-selection toggles and cannot open off-page or duplicate links',()=>{
 const selected=toggleBookmarkSelection(toggleBookmarkSelection([], 'a'),'b')
 assert.deepEqual(toggleBookmarkSelection(selected,'a'),['b'])
 assert.deepEqual(selectedBookmarkUrls([{id:'a',url:'https://example.com/'},{id:'b',url:'https://example.com/'}],[...selected,'hidden']),['https://example.com/'])
 assert.deepEqual(selectedBookmarkUrls([{id:'c',url:'https://example.com/c'}],selected),[])
})
test('batch open validates every URL before invoking the existing desktop bridge',()=>{
 const root=globalThis as typeof globalThis&{window?:unknown};const old=root.window;const opened:string[]=[]
 root.window={open:(url:string)=>opened.push(url)}
 try{
  openBookmarks(['https://example.com','https://example.com/','https://example.com/docs']);assert.deepEqual(opened,['https://example.com/','https://example.com/docs'])
  assert.throws(()=>openBookmarks(['https://example.com/new','javascript:alert(1)']));assert.equal(opened.length,2)
 }finally{root.window=old}
})
