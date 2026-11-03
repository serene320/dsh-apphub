import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { SessionReference } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { createNotesController } from '../../application/notes-controller.ts'
import type {} from '../../../lib/typert.remote-client.js'

type Task = {id:string;sessionId:string;title:string;status:'submitting'|'running'|'failed'|'waiting';message:string}
export function createTaskRunner(ctx: Context, notes: ReturnType<typeof createNotesController>) {
  let state = {busy:false,tasks:[] as Task[]}, disposed=false, refreshPending=false
  const listeners=new Set<()=>void>()
  const jobs=new Map<string,{reference?:SessionReference;timer?:ReturnType<typeof setTimeout>;abort:AbortController}>()
  const publish=()=>{if(disposed)return;state={...state};listeners.forEach(f=>f())}
  const update=(id:string,patch:Partial<Task>)=>{state.tasks=state.tasks.map(t=>t.id===id?{...t,...patch}:t);publish()}
  const finish=(id:string)=>{const job=jobs.get(id);clearTimeout(job?.timer);job?.abort.abort();job?.reference?.release();jobs.delete(id)}
  const refresh=()=>{if(disposed||!refreshPending)return;const n=notes.getSnapshot();if(n.busy||n.dirty)return;refreshPending=false;void notes.load()}
  const unsubscribe=notes.subscribe(refresh)
  async function bounded<T>(fn:(signal:AbortSignal)=>Promise<T>,parent:AbortSignal):Promise<T>{
    const abort=new AbortController()
    let timer:ReturnType<typeof setTimeout>|undefined
    const cancel=()=>abort.abort(parent.reason)
    parent.addEventListener('abort',cancel,{once:true})
    if(parent.aborted)cancel()
    try{return await Promise.race([fn(abort.signal),new Promise<never>((_,reject)=>{
      const stopped=()=>reject(Error('任务连接已中断。'))
      abort.signal.addEventListener('abort',stopped,{once:true})
      if(abort.signal.aborted)stopped()
      timer=setTimeout(()=>{reject(Error('连接超时，请查看任务会话确认结果。'));abort.abort()},15000)
    })])}finally{clearTimeout(timer);parent.removeEventListener('abort',cancel)}
  }
  return {
    getSnapshot:()=>state,
    subscribe(f:()=>void){listeners.add(f);return()=>{listeners.delete(f)}},
    openSession(id:string){const task=state.tasks.find(t=>t.id===id);if(task?.sessionId)ctx.uiWorkspace.openSession(task.sessionId as SessionId)},
    dismiss(id:string){const task=state.tasks.find(t=>t.id===id);if(task?.status!=='failed')return;finish(id);state.tasks=state.tasks.filter(t=>t.id!==id);publish()},
    async run(prompt:string) {
      if(disposed||state.busy)return false
      const id=crypto.randomUUID(), noteId=crypto.randomUUID()
      const job:{reference?:SessionReference;timer?:ReturnType<typeof setTimeout>;abort:AbortController}={abort:new AbortController()}
      jobs.set(id,job)
      state={busy:true,tasks:[...state.tasks,{id,sessionId:'',title:prompt.slice(0,60),status:'submitting',message:'正在准备…'}]};publish()
      try {
        const sessionId=await bounded(()=>ctx.sessions.create(),job.abort.signal)
        if(disposed)return false
        update(id,{sessionId})
        job.reference=ctx.sessions.retain(sessionId,{source:'controllerOperation'})
        const binding=await bounded(()=>job.reference!.ready,job.abort.signal)
        if(disposed)return false
        const prepared=await bounded(signal=>ctx.remote.apphub.prepareTask(id,sessionId,noteId,signal),job.abort.signal)
        if(!prepared.ok)throw Error('任务准备失败')
        if(disposed)return false
        const text='这是用户从 AppHub 提交的备忘录任务。请完成用户要求，调用 apphub_create_note 保存结果。根据内容和用户要求，可以多次调用工具创建多张独立便签。不要写文件、操作其他应用或调用其他副作用工具。所有便签保存后简短回复；如果保存失败，明确说明未完成部分。\n\n用户任务：\n'+prompt
        const submission=binding.session.beginSubmission({mode:'queue',text,attachments:[]})
        const result=await bounded(()=>binding.session.prompt([{type:'text',text}],'queue',undefined,submission.requestId),job.abort.signal)
        if(!result.ok)throw Error('任务提交失败：'+result.error.code)
        if(disposed)return false
        update(id,{status:'running',message:'执行中'})
        const started=Date.now()
        const poll=async()=>{
          if(disposed||!jobs.has(id))return
          try {
            const result=await bounded(signal=>ctx.remote.apphub.getTask(id,signal),job.abort.signal)
            if(disposed)return
            if(!result.ok)throw Error('无法读取任务状态')
            const saved=result.value.savedCount
            const snapshot=binding.session.getSnapshot()
            if(snapshot.lastAgentError || snapshot.promptError)throw Error(saved?`已保存 ${saved} 张，任务异常结束。`:'执行失败，请查看任务会话。')
            if(Date.now()-started>6000&&!snapshot.running&&!snapshot.awaitingFirstTurn){
              if(result.value.status!=='saved')throw Error(saved?`已保存 ${saved} 张，仍有未确认或失败的保存。`:'任务已结束，未收到保存结果。')
              state.tasks=state.tasks.filter(t=>t.id!==id);publish();finish(id)
              refreshPending=true;refresh();return
            }
            // A long-running session is not a failed task. Continue observing it.
            if(Date.now()-started>180000)update(id,{status:'waiting',message:'仍在执行'})
          }catch(error){if(disposed)return;update(id,{status:'failed',message:error instanceof Error?error.message:'任务失败'});finish(id);refreshPending=true;refresh();return}
          job.timer=setTimeout(()=>{void poll()},Date.now()-started>180000?5000:1000)
        }
        void poll();return true
      }catch(error){if(!disposed){update(id,{status:'failed',message:error instanceof Error?error.message:'任务启动失败'});finish(id)}return false}
      finally{state.busy=false;publish()}
    },
    dispose(){disposed=true;for(const id of jobs.keys())finish(id);unsubscribe();listeners.clear()},
  }
}
