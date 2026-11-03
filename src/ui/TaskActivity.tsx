import React, {useState} from 'react'
import {Button,Menu,MenuItemButton,Toast} from '@deepseek-ai/dsh-client-ui-primitives'
type Activity={id:string;title:string;sessionId:string;status:'submitting'|'running'|'failed'|'waiting'|'completed';message:string}
export function TaskActivity({tasks,recent=[],onOpen,onDismiss}:{recent?:readonly Activity[];tasks:readonly Activity[];onOpen(id:string):void;onDismiss(id:string):void}) {
  const [open,setOpen]=useState(false),[dismissed,setDismissed]=useState<string[]>([])
  const failure=tasks.find(t=>t.status==='failed'&&!dismissed.includes(t.id))
  const running=tasks.filter(t=>t.status!=='failed').length
  const failed=tasks.length-running
  const entries=[...tasks,...recent]
  return <>{entries.length>0&&<Menu listClassName="hub-task-result-menu" open={open} onClose={()=>setOpen(false)} align="end" side="top" autoFocus anchor={<Button size="sm" className="hub-task-activity" aria-label="查看应用任务" aria-haspopup="menu" aria-expanded={open} onClick={()=>setOpen(!open)}>{running===1&&tasks.find(t=>t.status!=='failed')?.message!=='执行中'?tasks.find(t=>t.status!=='failed')?.message:[running?`${running} 个任务进行中`:'',failed?`${failed} 个异常`:''].filter(Boolean).join(' · ')||recent[0]?.message}</Button>}>{entries.map(task=><React.Fragment key={task.id}><MenuItemButton disabled={!task.sessionId} onSelect={()=>{setOpen(false);onOpen(task.id)}}><span className="hub-task-menu-item"><span className="hub-task-result-title">{task.title}</span><small>{task.message}</small></span></MenuItemButton>{(task.status==='failed'||task.status==='completed')&&<MenuItemButton onSelect={()=>{setOpen(false);onDismiss(task.id)}}>移除此记录</MenuItemButton>}</React.Fragment>)}</Menu>}
    {failure&&<Toast key={failure.id} text={failure.message} holdMs={5000} onDone={()=>setDismissed(ids=>[...ids,failure.id])} actions={failure.sessionId?[{label:'查看任务',onClick:()=>{setDismissed(ids=>[...ids,failure.id]);onOpen(failure.id)}}]:undefined}/>}
  </>
}
