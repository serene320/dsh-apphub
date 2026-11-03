import React, {useRef,useState} from 'react'
import {Button,IconPlusOutlineRegular,IconSendOutlineRegular,useDismissOnOutsidePointer} from '@deepseek-ai/dsh-client-ui-primitives'
import {capabilities} from '../application/tasks.ts'
export function TaskComposer({prompt,onPromptChange,onSubmit,taskBusy,error,target,activity}:{prompt:string;onPromptChange(value:string):void;onSubmit(text:string):Promise<boolean>;taskBusy:boolean;error:string;target:string;activity?:React.ReactNode}) {
  const [showMentions,setShowMentions]=useState(false), [selected,setSelected]=useState(0)
  const setPrompt=onPromptChange
  const input=useRef<HTMLTextAreaElement>(null)
  const taskRoot=useRef<HTMLElement>(null)
  useDismissOnOutsidePointer(taskRoot,showMentions,setShowMentions)
  const choices=capabilities.filter(c=>c.mention.includes((prompt.startsWith('@')?prompt.split(/\s/)[0]:'@') || '@'))
  const pick=(mention:string)=>{setPrompt(mention+' '+prompt.replace(/^@\S*\s*/,''));setShowMentions(false);input.current?.focus()}
  const submit=()=>{if(taskBusy) return;void onSubmit(prompt).then(ok=>{if(ok) setPrompt('')})}
  return <div className="hub-composer">
    <section ref={taskRoot} className="hub-task" aria-label="新任务" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setShowMentions(false)}} onKeyDown={e=>{if(e.key==='Escape'&&showMentions){e.preventDefault();e.stopPropagation();setShowMentions(false);input.current?.focus()}}}><textarea ref={input} aria-label="AppHub 任务" placeholder="描述任务" value={prompt} disabled={taskBusy} onChange={e=>{setPrompt(e.target.value);setShowMentions(e.target.value.startsWith('@')&&!e.target.value.includes(' '));setSelected(0)}} onKeyDown={e=>{if(e.nativeEvent.isComposing) return;if(showMentions){if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setShowMentions(false);return}if(!choices.length){if(e.key==='Enter')e.preventDefault();return}if(e.key==='ArrowDown'){e.preventDefault();setSelected(v=>(v+1)%choices.length)}else if(e.key==='ArrowUp'){e.preventDefault();setSelected(v=>(v+choices.length-1)%choices.length)}else if(e.key==='Enter'){e.preventDefault();pick(choices[selected%choices.length]!.mention)}else if(e.key==='Escape')setShowMentions(false)}else if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();submit()}}}/>
      {showMentions&&<div className="hub-mentions" role="listbox" aria-label="应用与功能">{choices.map((c,i)=><Button size="sm" type="button" role="option" aria-selected={i===selected} key={c.mention} onClick={()=>pick(c.mention)}><strong>{c.mention}</strong><span>{c.description}</span></Button>)}{!choices.length&&<p>没有匹配的应用或功能</p>}</div>}
      <footer><Button size="sm" className="hub-mention-trigger" aria-label="选择应用或功能" aria-expanded={showMentions} aria-haspopup="listbox" onClick={()=>{setShowMentions(!showMentions);input.current?.focus()}} disabled={taskBusy}><IconPlusOutlineRegular size={18}/></Button><div className="hub-composer-target"><span>{target}</span>{activity}</div><Button size="sm" variant="primary" className="hub-run" aria-label="执行任务" disabled={!prompt.trim()||taskBusy} onClick={submit}><IconSendOutlineRegular size={18}/></Button></footer>
    </section><p className="hub-feedback" role="status">{error}</p>
  </div>
}
