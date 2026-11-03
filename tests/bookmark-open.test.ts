import {test} from 'node:test'
import assert from 'node:assert/strict'
import {openBookmark} from '../src/adapter/client/bookmark-files.ts'
test('a bookmark opens once through the desktop route and rejects unsafe URLs',()=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'window'),opened:unknown[][]=[]
 Object.defineProperty(globalThis,'window',{configurable:true,value:{open:(...args:unknown[])=>opened.push(args)}})
 try{openBookmark('https://example.com');assert.deepEqual(opened,[['https://example.com/','_blank','noopener,noreferrer']]);assert.throws(()=>openBookmark('javascript:alert(1)'));assert.equal(opened.length,1)}
 finally{if(previous)Object.defineProperty(globalThis,'window',previous);else Reflect.deleteProperty(globalThis,'window')}
})
