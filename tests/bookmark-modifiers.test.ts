import {test} from 'node:test'
import assert from 'node:assert/strict'
import {watchBookmarkModifiers} from '../src/adapter/client/bookmark-modifiers.ts'
test('window capture observes modifier release without card focus and detaches on unmount',()=>{
 const target=new EventTarget(),visibility=Object.assign(new EventTarget(),{hidden:false});let released=0,cancelled=0
 const stop=watchBookmarkModifiers(()=>released++,()=>cancelled++,target,visibility)
 const key=(type:string,value:string)=>{const e=new Event(type);Object.defineProperty(e,'key',{value});target.dispatchEvent(e)}
 key('keyup','a');assert.equal(released,0);key('keyup','Meta');key('keyup','Control');assert.equal(released,2)
 key('keydown','Escape');target.dispatchEvent(new Event('blur'));visibility.hidden=true;visibility.dispatchEvent(new Event('visibilitychange'));assert.equal(cancelled,3)
 stop();key('keyup','Meta');target.dispatchEvent(new Event('blur'));assert.equal(released,2);assert.equal(cancelled,3)
})

test('rapid selection and release needs no render, lost keyup recovers once, blur never opens',async()=>{
 const {createBookmarkSelection}=await import('../src/application/bookmark-selection.ts')
 const model=createBookmarkSelection(),target=new EventTarget(),visibility=new EventTarget();const opened:string[][]=[]
 const stop=watchBookmarkModifiers(()=>{const ids=model.release();if(ids?.length)opened.push(ids)},model.clear,target,visibility)
 const event=(type:string,props:object={})=>{const e=new Event(type);Object.assign(e,props);target.dispatchEvent(e)}
 try{
  model.begin();event('pointermove',{metaKey:false});assert.equal(model.snapshot().selecting,true);model.clear()
  model.toggle('a',true);model.toggle('b',true);event('keyup',{key:'Meta',metaKey:false});assert.deepEqual(opened,[['a','b']]);assert.equal(model.snapshot().selecting,false)
  event('pointermove',{metaKey:false});assert.equal(opened.length,1)
  model.toggle('c',true);event('pointermove',{metaKey:true});assert.equal(opened.length,1);event('pointermove',{metaKey:false});assert.deepEqual(opened[1],['c'])
  event('pointerdown',{metaKey:true});model.toggle('d',true);model.toggle('d',true);event('pointermove',{metaKey:false});assert.equal(model.snapshot().selecting,false);assert.equal(opened.length,2)
  model.toggle('e',true);event('blur');event('keyup',{key:'Meta'});assert.equal(opened.length,2)
  model.toggle('f',true);event('keyup',{key:'Control',metaKey:true});assert.equal(model.snapshot().selecting,true);event('keyup',{key:'Meta',metaKey:false});assert.deepEqual(opened[2],['f'])
 }finally{stop()}
})
