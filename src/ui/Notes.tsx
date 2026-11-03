import { Tooltip, Button, Input, SegmentedTabs, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import React, {useState, useId} from 'react'
import { Icon, NotesIcon } from './Icons.tsx'
import { notePapers } from '../application/notes.ts'
import type { NotesState } from '../application/notes-controller.ts'
export interface NotesProps {
  appearance?: 'host' | 'light' | 'dark'
  locked?: boolean
  onArchive(archived:boolean):Promise<boolean>
  onCloseEditor():Promise<boolean>
  onSettings(): void
  state: NotesState
  onCreate(): void
  onSelect(id: string): void
  onEdit(field: 'title' | 'body' | 'color' | 'pinned' | 'archived', value: string | boolean): void
  onSave(): void
  onRestore(id:string): void
  onReload(): void
}
// Presentation stays independent of the notes controller and Host storage.
export function Notes({ appearance = 'host', locked = false, onSettings, state, onArchive, onCloseEditor, onCreate, onSelect, onEdit, onSave, onReload, onRestore }: NotesProps) {
  const [query,setQuery]=useState(''),[archived,setArchived]=useState(false)
  const tabsId = useId()
  const draft = state.draft
  const title=(n:{title:string;body:string})=>n.title.trim()||n.body.split('\n')[0]?.slice(0,30)||'一张新便签'
  const items=state.notes.filter(n=>!!n.archived===archived&&(n.title+n.body).toLowerCase().includes(query.toLowerCase())).sort((a,b)=>Number(!!b.pinned)-Number(!!a.pinned)||b.createdAt.localeCompare(a.createdAt))
  return <main className="notes-library">
    <div className="notes-collection">
      <header className="notes-library-heading"><div className="notes-heading-copy"><div className="notes-brand"><NotesIcon size={32}/><h1>备忘录</h1></div><p>所有想法，都在这里。</p></div><Tooltip label="备忘录设置" side="top" portal><Button size="sm" aria-label="备忘录设置" onClick={onSettings}><Icon name="settings"/></Button></Tooltip><Tooltip label="新建便签" side="top" portal><Button size="sm" aria-label="新建便签" onClick={onCreate} disabled={locked||!state.loaded||state.busy||state.dirty}><Icon name="plus"/></Button></Tooltip></header>
      <div className="notes-search-field"><Input icon={<Icon name="search" size={16}/>} aria-label="搜索便签标题与正文" placeholder="搜索便签" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<Button size="sm" aria-label="清除搜索" onClick={()=>setQuery('')}><Icon name="close" size={14}/></Button>}</div>
      <SegmentedTabs className="notes-filter" label="备忘录范围" value={archived?'archived':'active'} onChange={value=>setArchived(value==='archived')} items={[{value:'active',label:`便签 ${state.notes.filter(n=>!n.archived).length}`,id:tabsId+'-active',panelId:tabsId+'-list'},{value:'archived',label:`已归档 ${state.notes.filter(n=>n.archived).length}`,id:tabsId+'-archived',panelId:tabsId+'-list'}]}/>
      {state.loadError&&<div className="notes-load-error" role="alert"><span>{state.loadError}</span><Button size="sm" onClick={onReload} disabled={state.busy||state.dirty}>重试</Button></div>}
      {state.recoveryError&&<p role="alert">{state.recoveryError}</p>}
      {state.recoverable.map(d=><div className="notes-recovery" key={d.id}><span>{d.title||'未命名草稿'}</span><Button size="sm" onClick={()=>onRestore(d.id)} disabled={state.busy||state.dirty}>{(state.notes.find(n=>n.id===d.id)?.revision??0)!==d.expectedRevision?'恢复为副本':'恢复草稿'}</Button></div>)}
      <div id={tabsId+'-list'} role="tabpanel" aria-labelledby={tabsId+(archived?'-archived':'-active')} className="notes-library-list" aria-label="便签列表">{items.map(note=><Button size="sm" className={'notes-library-item paper-'+(note.color||'cream')+(draft?.id===note.id?' is-selected':'')} key={note.id} onClick={()=>onSelect(note.id)} disabled={locked||(!draft&&(state.busy||state.dirty))}><strong>{note.pinned&&<Icon name="pin" size={12}/>}<span>{title(note)}</span></strong><p>{note.body.trim()||'留一点空白，给下一个想法。'}</p><time>{new Date(note.updatedAt).toLocaleString('zh-CN',{month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'})}</time></Button>)}{state.loaded&&!items.length&&<p className="notes-list-empty">{query?'没有找到便签。':archived?'还没有归档便签。':'留一点空白，给下一个想法。'}</p>}{!state.loaded&&!state.busy&&!state.loadError&&<Button size="sm" onClick={onReload}>重新读取</Button>}</div>
    </div>
    <Modal open={!!draft} headless title="便签编辑器" onClose={()=>{void onCloseEditor()}} className={'notes-editor-dialog apphub-appearance-'+appearance+' paper-'+(draft?.color||'cream')}>
      <header className="notes-editor-toolbar"><span className="notes-editor-caption"><Icon name="note" size={16}/>{draft?.archived?'已归档':'随手记'}</span>{draft&&<div><Tooltip label={draft.pinned?'取消置顶':'置顶便签'} side="top" portal><Button size="sm" aria-label={draft.pinned?'取消置顶':'置顶便签'} aria-pressed={!!draft.pinned} disabled={locked||state.busy} onClick={()=>{onEdit('pinned',!draft.pinned);onSave()}}><Icon name="pin"/></Button></Tooltip><Tooltip label={draft.archived?'恢复便签':'归档便签'} side="top" portal><Button size="sm" aria-label={draft.archived?'恢复便签':'归档便签'} disabled={locked||state.busy} onClick={()=>{void onArchive(!draft.archived)}}><Icon name={draft.archived?'restore':'archive'}/><span>{draft.archived?'恢复':'归档'}</span></Button></Tooltip><Tooltip label="关闭便签（Esc）" side="top" portal><Button size="sm" aria-label="关闭便签" disabled={state.busy} onClick={()=>{void onCloseEditor()}}><Icon name="close"/></Button></Tooltip></div>}</header>
      {draft?<><div className="notes-editor-content"><div className="notes-editor-date"><i/>{state.notes.find(n=>n.id===draft.id)?.createdAt?new Date(state.notes.find(n=>n.id===draft.id)!.createdAt).toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric'}):'新便签'}</div><input className="notes-title" aria-label="便签标题" placeholder="一张新便签" maxLength={200} value={draft.title} disabled={locked} onChange={e=>onEdit('title',e.target.value)}/><textarea className="notes-body" aria-label="便签正文" placeholder="此刻，想记下什么？" maxLength={100000} value={draft.body} disabled={locked} onChange={e=>onEdit('body',e.target.value)}/></div><footer className="notes-editor-footer">{state.recoveryError&&<span role="alert">{state.recoveryError}</span>}<div className="notes-colors" aria-label="便签纸色">{notePapers.map(p=><Tooltip key={p.id} label={p.name} side="top" portal><Button size="sm" className={'color-dot paper-'+p.id} aria-label={'纸色：'+p.name} aria-pressed={(draft.color||'cream')===p.id} disabled={locked} onClick={()=>onEdit('color',p.id)}><span/>{(draft.color||'cream')===p.id&&<Icon name="check" size={12}/>}</Button></Tooltip>)}</div><span className="notes-save-state" role="status"><span>{draft.body.length} 字</span><span className="notes-save-label">{draft.expectedRevision>0&&!state.dirty&&!state.busy&&<Icon name="check" size={13}/>} {state.message||(draft.expectedRevision>0?'已保存到本机':'')}</span></span>{state.saveFailed&&!state.busy&&<Button size="sm" onClick={onSave}><Icon name="save" size={15}/>重试</Button>}</footer></>:<div className="notes-library-empty"><NotesIcon size={56}/><h2>给想法留个位置</h2><p>随手记下，稍后继续。</p><Button size="sm" onClick={onCreate} disabled={locked||!state.loaded}><Icon name="plus" size={16}/>新建一张便签</Button><span role="status">{state.message}</span></div>}
    </Modal>
  </main>
}
