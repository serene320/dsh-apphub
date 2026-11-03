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
