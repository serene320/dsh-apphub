import { Tooltip, Button, Input, Menu, MenuItemButton } from '@deepseek-ai/dsh-client-ui-primitives'
import { Icon } from './Icons.tsx'
import { NotesIcon,BookmarkIcon } from './Icons.tsx'
import React, {useState} from 'react'
import type { HomeState } from '../application/home-controller.ts'
export function HubIcon({ size = 24 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="2" fill="currentColor"/><rect x="14" y="3" width="7" height="7" rx="2" fill="currentColor" opacity=".55"/><rect x="3" y="14" width="7" height="7" rx="2" fill="currentColor" opacity=".55"/><rect x="14" y="14" width="7" height="7" rx="2" fill="currentColor"/></svg>
}
function AppActions({name,onOpen,onTask,onSettings}:{name:string;onOpen():void;onTask():void;onSettings():void}) {
  const [open,setOpen]=useState(false)
  const select=(action:()=>void)=>{setOpen(false);action()}
  return <Menu open={open} onClose={()=>setOpen(false)} align="end" autoFocus anchor={<Button size="sm" aria-label={name+'操作'} aria-haspopup="menu" aria-expanded={open} onClick={()=>setOpen(!open)}><Icon name="more" size={16}/></Button>}><MenuItemButton onSelect={()=>select(onOpen)}>打开应用</MenuItemButton><MenuItemButton onSelect={()=>select(onTask)}>新建任务</MenuItemButton><MenuItemButton onSelect={()=>select(onSettings)}>备忘录设置</MenuItemButton></Menu>
}
export function Home({state,onRefresh,onOpen,onSettings,onAppSettings,onTask}: {state:HomeState;onRefresh():void;onOpen(id:string):void;onSettings():void;onAppSettings():void;onTask(id:string):void}) {
  const [search,setSearch]=useState('')
  const apps=state.status==='ready'?state.snapshot.apps.filter(a=>(a.name+a.description).toLowerCase().includes(search.toLowerCase())):[]
  return <main className="apphub-home hub-directory"><div className="hub-content">
    <header className="hub-heading"><div><h1>AppHub</h1><p>你的应用，一句话开始。</p></div><div className="hub-actions"><Input className="hub-search" icon={<Icon name="search" size={16}/>} aria-label="搜索应用" placeholder="搜索应用" value={search} onChange={e=>setSearch(e.target.value)}/><Tooltip label="设置" side="top" portal><Button size="sm" className="hub-icon-button" aria-label="AppHub 设置" onClick={onSettings}><Icon name="settings" size={16}/></Button></Tooltip></div></header>
    <section className="hub-app-section"><div className="hub-section-heading"><h2>我的应用</h2><span>{state.status==='ready'?`${state.snapshot.apps.length} 个应用`:''}</span></div>
      {state.status==='loading'||state.status==='idle'?<p className="hub-muted">正在加载应用…</p>:state.status==='error'?<div role="alert"><p>应用加载失败。</p><Button size="sm" className="apphub-button" onClick={onRefresh}>重试</Button></div>:<div className="hub-app-list">{apps.map(a=><article className="hub-app-row" key={a.id}><Button size="sm" className="hub-app-open" onClick={()=>onOpen(a.id)}><span className="hub-app-icon" aria-hidden="true">{a.id==='notes'?<NotesIcon size={36}/>:<BookmarkIcon size={28}/ >}</span><span><strong>{a.name}</strong><small>{a.description}</small></span></Button>{a.id==='notes'&&<AppActions name={a.name} onOpen={()=>onOpen(a.id)} onTask={()=>onTask(a.id)} onSettings={onAppSettings}/>}</article>)}{apps.length===0&&<p className="hub-muted">{search?'没有找到匹配的应用。':'尚未接入应用。'}</p>}</div>}
    </section>
  </div></main>
}
