import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createTaskRunner} from '../src/adapter/client/task-runner.ts'
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve()}
test('independent tasks wait for session completion, refresh without selecting, and defer refresh during editing',async t=>{
  t.mock.timers.enable({apis:['setTimeout','Date'],now:10000})
  let count=0,loads=0,dirty=false
  const listeners=new Set<()=>void>()
  const sessions=new Map<string,{running:boolean;released:boolean}>()
  const ids=new Map<string,string>()
  const ctx:any={sessions:{
    create:async()=>{const id='s'+(++count);sessions.set(id,{running:true,released:false});return id},
    retain:(id:string)=>({release:()=>{sessions.get(id)!.released=true},ready:Promise.resolve({session:{
      beginSubmission:()=>({requestId:'r'}),prompt:async()=>({ok:true}),getSnapshot:()=>({running:sessions.get(id)!.running,awaitingFirstTurn:false}),
    }})}),
  },remote:{apphub:{prepareTask:async(id:string,sessionId:string)=>{ids.set(id,sessionId);return {ok:true}},getTask:async()=>({ok:true,value:{status:'saved'}})}},uiWorkspace:{openSession:()=>{}}}
  const notes:any={getSnapshot:()=>({busy:false,dirty}),subscribe:(f:()=>void)=>{listeners.add(f);return()=>listeners.delete(f)},load:async()=>{loads++},select:()=>assert.fail('must not open editor')}
  const runner=createTaskRunner(ctx,notes)
  try{
    assert.equal(await runner.run('第一份思路'),true)
    assert.equal(runner.getSnapshot().busy,false)
    assert.equal(await runner.run('第二份思路'),true)
    await flush()
    assert.equal(runner.getSnapshot().tasks.length,2)
    assert.equal(loads,0,'first note must not finish running session')
    sessions.get('s1')!.running=false;dirty=true
    t.mock.timers.tick(7000);await flush()
    assert.equal(runner.getSnapshot().tasks.length,1)
    assert.equal(sessions.get('s1')!.released,true)
    assert.equal(sessions.get('s2')!.released,false)
    assert.equal(loads,0)
    dirty=false;listeners.forEach(f=>f());await flush()
    assert.equal(loads,1)
    sessions.get('s2')!.running=false
    t.mock.timers.tick(1000);await flush()
    assert.equal(runner.getSnapshot().tasks.length,0)
    assert.equal(loads,2)
  }finally{runner.dispose()}
  assert.equal(listeners.size,0)
})
function scenario(t:any,summary:any={status:'saved',savedCount:1,failedCount:0,pendingCount:0}){
 t.mock.timers.enable({apis:['setTimeout','Date'],now:10000})
 let running=true
 const ctx:any={sessions:{create:async()=>'s',retain:()=>({release:()=>{},ready:Promise.resolve({session:{beginSubmission:()=>({requestId:'r'}),prompt:async()=>({ok:true}),getSnapshot:()=>({running,awaitingFirstTurn:false})}})})},remote:{apphub:{prepareTask:async()=>({ok:true}),getTask:async()=>({ok:true,value:summary})}},uiWorkspace:{openSession:()=>{}}}
 const notes:any={getSnapshot:()=>({busy:false,dirty:false}),subscribe:()=>()=>{},load:async()=>{}}
 return {ctx,notes,end:()=>{running=false}}
}
test('partial saves remain actionable and the failed record can be dismissed',async t=>{
 const s=scenario(t,{status:'partial',savedCount:1,failedCount:1,pendingCount:0}),r=createTaskRunner(s.ctx,s.notes)
 try{await r.run('two');await flush();s.end();t.mock.timers.tick(7000);await flush()
 const failed=r.getSnapshot().tasks[0]!
 assert.equal(failed.status,'failed');assert.match(failed.message,/已保存 1 张/)
 r.dismiss(failed.id);assert.equal(r.getSnapshot().tasks.length,0)
 }finally{r.dispose()}
})
test('long-running task stays monitored and later completion clears it',async t=>{
 const s=scenario(t),r=createTaskRunner(s.ctx,s.notes)
 try{await r.run('long');await flush();t.mock.timers.tick(181000);await flush()
 assert.equal(r.getSnapshot().tasks[0]?.status,'waiting');assert.equal(r.getSnapshot().busy,false)
 s.end();t.mock.timers.tick(5000);await flush();assert.equal(r.getSnapshot().tasks.length,0)
 }finally{r.dispose()}
})
test('stalled preparation releases composer and surfaces failure',async t=>{
 const s=scenario(t);s.ctx.remote.apphub.prepareTask=()=>new Promise(()=>{})
 const r=createTaskRunner(s.ctx,s.notes)
 try{const pending=r.run('blocked');await flush();t.mock.timers.tick(16000);await flush()
 assert.equal(await pending,false);assert.equal(r.getSnapshot().busy,false);assert.equal(r.getSnapshot().tasks[0]?.status,'failed')
 }finally{r.dispose()}
})

test('bookmark tasks accept existing results and refresh bookmarks without opening a note',async t=>{
 const s=scenario(t);let loads=0,text=''
 s.ctx.remote.apphub.prepareBookmarkTask=async()=>({ok:true})
 s.ctx.remote.apphub.getBookmarkTask=async()=>({ok:true,value:{status:'saved',savedCount:0,existingCount:3,failedCount:0,pendingCount:0}})
 s.notes.load=()=>assert.fail('bookmark task must not refresh notes')
 s.ctx.sessions.retain=()=>({release:()=>{},ready:Promise.resolve({session:{beginSubmission:(arg:any)=>{text=arg.text;return {requestId:'r'}},prompt:async()=>({ok:true}),getSnapshot:()=>({running:false,awaitingFirstTurn:false})}})})
 const runner=createTaskRunner(s.ctx,s.notes,{load:async()=>{loads++}})
 try{await runner.run('整理网站','bookmarks');await flush();t.mock.timers.tick(7000);await flush();assert.equal(runner.getSnapshot().tasks.length,0);assert.ok(loads>0);assert.equal(runner.getSnapshot().recent[0]?.message,'新增 0 · 已有 3');assert.match(text,/apphub_create_bookmarks/);assert.doesNotMatch(text,/apphub_create_note/)}finally{runner.dispose()}
})
