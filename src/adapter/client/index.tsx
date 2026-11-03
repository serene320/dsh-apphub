import {bookmarkExporter} from './bookmark-export.ts'
import {useBookmarkLoadMore} from './bookmark-load-more.ts'
import {useBookmarkMedia} from './bookmark-media.ts'
import {createBookmarksController} from '../../application/bookmarks-controller.ts'
import {chooseBookmarkFile,openBookmark} from './bookmark-files.ts'
import {Bookmarks} from '../../ui/Bookmarks.tsx'
import {apps} from '../../application/hub.ts'
import bookmarksCss from '../../ui/bookmarks.css'
import React, { useEffect, useState, useSyncExternalStore } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-api-gateway/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import remote from '../../../lib/typert.remote-client.js'
import type { HubPort } from '../../application/home-controller.ts'
import { createHomeController } from '../../application/home-controller.ts'
import { createNotesController } from '../../application/notes-controller.ts'
import { createSettingsController } from '../../application/settings-controller.ts'
import { resolveTask } from '../../application/tasks.ts'
import { createDraftJournal } from './draft-journal.ts'
import { createTaskRunner } from './task-runner.ts'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { TaskActivity } from '../../ui/TaskActivity.tsx'
import { TaskComposer } from '../../ui/TaskComposer.tsx'
import { NotesIcon, BookmarkIcon } from '../../ui/Icons.tsx'
import { Home, HubIcon } from '../../ui/Home.tsx'
import { Notes } from '../../ui/Notes.tsx'
import { Settings } from '../../ui/Settings.tsx'
import css from '../../ui/home.css'
import notesCss from '../../ui/notes.css'
import appearanceCss from '../../ui/appearance.css'

const PANEL = 'apphub' as MainPanelId
export const inject = ['slots', 'layout', 'remote', 'sessions', 'uiWorkspace', 'fileUpload']
type NotesController = ReturnType<typeof createNotesController>
type SettingsController = ReturnType<typeof createSettingsController>
type Runner = ReturnType<typeof createTaskRunner>
interface SurfaceProps { exportBookmarks:ReturnType<typeof bookmarkExporter>; bookmarks:ReturnType<typeof createBookmarksController>; port: HubPort; notes: NotesController; settings: SettingsController; noteSettings: SettingsController; runner: Runner }
function Surface({exportBookmarks,port,notes,settings,noteSettings,runner,bookmarks}:SurfaceProps) {
  const [prompt,setPrompt]=useState('')
  const [home] = useState(()=>createHomeController(port))
  const [page,setPage]=useState('notes')
  const [bookmarkView,setBookmarkView]=useState('list')
  const bookmarkState=useSyncExternalStore(bookmarks.subscribe,bookmarks.getSnapshot)
  const media=useBookmarkMedia(bookmarkState.items)
  const {sentinel:loadMoreRef,viewport:bookmarkViewport}=useBookmarkLoadMore(page==='bookmarks'&&bookmarkState.loaded&&!bookmarkState.loading&&!bookmarkState.loadingMore&&!bookmarkState.busy&&!bookmarkState.error&&bookmarkState.items.length<bookmarkState.total,bookmarkState.items.length,bookmarks.loadMore,bookmarkState.query+'\0'+bookmarkState.collection)
  const [settingsOpen,setSettingsOpen]=useState<'hub'|'notes'|null>(null), [inputError,setInputError]=useState('')
  const homeState=useSyncExternalStore(home.subscribe,home.getSnapshot)
  const notesState=useSyncExternalStore(notes.subscribe,notes.getSnapshot)
  const preferences=useSyncExternalStore(settings.subscribe,settings.getSnapshot)
  const notePreferences=useSyncExternalStore(noteSettings.subscribe,noteSettings.getSnapshot)
  const selectedSettings=settingsOpen==='notes'?noteSettings:settings
  const selectedPreferences=settingsOpen==='notes'?notePreferences:preferences
  const task=useSyncExternalStore(runner.subscribe,runner.getSnapshot)
  useEffect(()=>{void home.refresh();void notes.load();void bookmarks.load();return()=>home.dispose()},[home])
  const openNotes=()=>{setPage('notes');if(!notes.getSnapshot().loaded)void notes.load()}
  const openApp=(id:string)=>{if(id==='notes')openNotes();else if(id==='bookmarks'){setPage('bookmarks');void bookmarks.load()}}
  const submit=async(text:string)=>{
    try {
      const command=resolveTask(text,page==='bookmarks'?'bookmarks':'notes')
      setInputError('');openApp(command.appId)
      if(command.action==='open')return true
      const accepted=await runner.run(command.prompt,command.appId,command.appId==='bookmarks'?bookmarkState.collection:'')
      return accepted
    }catch(error){setInputError(error instanceof Error?error.message:'任务无法执行');return false}
  }
  return <div className="apphub-shell" data-appearance={page==='notes'?notePreferences.value.appearance:preferences.value.appearance}>
    <div className="hub-workspace">
    <nav className="hub-navigation" aria-label="AppHub 应用导航"><Button size="sm" variant="ghost" aria-pressed={page==='home'} onClick={()=>setPage('home')}><HubIcon size={16}/>AppHub</Button><span className="hub-navigation-label">应用</span>{apps.map(app=><Button key={app.id} size="sm" variant="ghost" aria-pressed={page===app.id} onClick={()=>openApp(app.id)}>{app.id==='notes'?<NotesIcon size={18}/>:<BookmarkIcon size={18}/ >}{app.name}</Button>)}</nav>
    <div className="hub-workspace-main">
    <div className="hub-workspace-content">
    {page==='home'?<Home state={homeState} onRefresh={()=>{void home.refresh()}} onOpen={openApp} onSettings={()=>setSettingsOpen('hub')} onAppSettings={()=>setSettingsOpen('notes')} onTask={openApp}/>:page==='bookmarks'?<Bookmarks onExport={async(format,task)=>{try{return await exportBookmarks(bookmarkState.query,bookmarkState.collection,format,task)}catch(e){bookmarks.reportError(e instanceof Error?e.message:'导出失败');return false}}} view={bookmarkView} onViewChange={setBookmarkView} viewportRef={bookmarkViewport} onRefreshPreview={id=>{void bookmarks.refreshPreview(id)}} media={media} onFilter={bookmarks.filter} loadMoreRef={loadMoreRef} state={bookmarkState} appearance={preferences.value.appearance} onSave={bookmarks.save} onRemove={bookmarks.remove} onImport={()=>chooseBookmarkFile(html=>{void bookmarks.preview(html)},bookmarks.reportError)} onConfirmImport={()=>{void bookmarks.importHtml()}} onCloseImport={bookmarks.clearImport} onOpen={openBookmark} onReload={()=>{void bookmarks.load()}}/>:<>


      <Notes appearance={notePreferences.value.appearance} onArchive={async archived=>{const ok=await notes.setArchived(archived);if(ok)notes.close();return ok}} onCloseEditor={notes.closeEditor} state={notesState} onSettings={()=>setSettingsOpen('notes')} onCreate={()=>notes.create()} onSelect={notes.select} onEdit={notes.edit} onSave={()=>{void notes.save()}} onRestore={notes.restore} onReload={()=>{void notes.load()}}/>
    </>}
    </div>
    {<TaskComposer prompt={prompt} onPromptChange={setPrompt} onSubmit={submit} taskBusy={task.busy} error={inputError} scope={page==='bookmarks'?{value:bookmarkState.collection,choices:bookmarkState.collections,onChange:collection=>bookmarks.filter(bookmarkState.query,collection)}:undefined} target={page==='bookmarks'?'收藏夹':'备忘录'} activity={<TaskActivity tasks={task.tasks.filter(t=>page==='home'||t.appId===page)} recent={task.recent.filter(t=>page==='home'||t.appId===page)} onOpen={runner.openSession} onDismiss={runner.dismiss}/>}/>}
    </div></div>
    {settingsOpen&&<Settings scope={settingsOpen} value={selectedPreferences.value} busy={selectedPreferences.busy} error={selectedPreferences.error} loaded={selectedPreferences.loaded} onRetry={()=>{void selectedSettings.load()}} onSave={selectedSettings.save} onClose={()=>setSettingsOpen(null)}/>}
  </div>
}
export async function apply(ctx: Context) {
  const unmountRemote = await ctx.remote.$mount(remote)
  ctx.effect(() => unmountRemote)
  const style = document.createElement('style'); style.dataset.apphub='home'; style.textContent=css+notesCss+appearanceCss+bookmarksCss
  ctx.effect(()=>{document.head.append(style);return()=>style.remove()})
  ctx.inject(['remote.apphub'], scope=>{
    const port:HubPort={read:async(id,signal)=>{const r=await scope.remote.apphub.read(id,signal);if(!r.ok)throw Error(r.error.code);return r.value}}
    const notes=createNotesController({
      list:async signal=>{const r=await scope.remote.apphub.listNotes(signal);if(!r.ok)throw Error(r.error.code);return r.value},
      save:async(input,signal)=>{const r=await scope.remote.apphub.saveNote(input,signal);if(!r.ok)throw Error(r.error.code);return r.value},
    },createDraftJournal(localStorage))
    const bookmarkRequests=new Set<AbortController>()
    async function bookmarkRequest<T>(call:(signal:AbortSignal)=>Promise<T>):Promise<T>{
      const abort=new AbortController();bookmarkRequests.add(abort)
      let timer:ReturnType<typeof setTimeout>|undefined
      try{return await Promise.race([call(abort.signal),new Promise<never>((_,reject)=>{
        const cancel=()=>reject(Error('操作尚未确认，请刷新检查后重试。'))
        abort.signal.addEventListener('abort',cancel,{once:true})
        timer=setTimeout(()=>abort.abort(),15000)
      })])}finally{clearTimeout(timer);bookmarkRequests.delete(abort)}
    }
    scope.effect(()=>()=>{for(const request of bookmarkRequests)request.abort();bookmarkRequests.clear()})
    const bookmarks=createBookmarksController({
      refreshPreview:async id=>{const r=await bookmarkRequest(signal=>scope.remote.apphub.refreshBookmarkPreview(id,signal));if(!r.ok)throw Error(r.error.message||r.error.code)},
      query:async(query,collection,offset)=>{const r=await bookmarkRequest(signal=>scope.remote.apphub.queryBookmarks(query,collection,offset,signal));if(!r.ok)throw Error(r.error.message||r.error.code);return r.value},
      list:async()=>{const r=await bookmarkRequest(signal=>scope.remote.apphub.listBookmarks(signal));if(!r.ok)throw Error(r.error.code);return r.value},
      save:async input=>{const r=await bookmarkRequest(signal=>scope.remote.apphub.saveBookmark(input,signal));if(!r.ok)throw Error(r.error.message||r.error.code);return r.value},
      remove:async(id,revision)=>{const r=await bookmarkRequest(signal=>scope.remote.apphub.removeBookmark(id,revision,signal));if(!r.ok)throw Error(r.error.code);return r.value},
      preview:async html=>{const r=await bookmarkRequest(signal=>scope.remote.apphub.previewBookmarks(html,signal));if(!r.ok)throw Error(r.error.message||'书签文件无效。');return r.value},
      importHtml:async html=>{const r=await bookmarkRequest(signal=>scope.remote.apphub.importBookmarks(html,signal));if(!r.ok)throw Error(r.error.message||'导入失败。');return r.value},
    })
    const makeSettings=(kind:'hub'|'notes')=>createSettingsController({
      read:async()=>{const r=await scope.remote.apphub.settings(kind,new AbortController().signal);if(!r.ok)throw Error(r.error.code);return r.value},
      save:async value=>{const r=await scope.remote.apphub.saveSettings(kind,value,new AbortController().signal);if(!r.ok)throw Error(r.error.code);return r.value},
    })
    const settings=makeSettings('hub'),noteSettings=makeSettings('notes')
    void settings.load();void noteSettings.load()
    const exportBookmarks=bookmarkExporter(scope)
    const runner=createTaskRunner(scope,notes,bookmarks)
    scope.effect(()=>()=>{runner.dispose();notes.dispose();bookmarks.dispose()})
    // Flush early on backgrounding; a synchronous journal protects edits if teardown wins.
    scope.effect(()=>{
      const flush=()=>{if(notes.getSnapshot().dirty)void notes.save()}
      const beforeUnload=(event:BeforeUnloadEvent)=>{const n=notes.getSnapshot();if(n.dirty||n.busy){flush();event.preventDefault();event.returnValue=''}}
      const onVisibility=()=>{if(document.visibilityState==='hidden')flush()}
      window.addEventListener('beforeunload',beforeUnload)
      document.addEventListener('visibilitychange',onVisibility)
      return()=>{window.removeEventListener('beforeunload',beforeUnload);document.removeEventListener('visibilitychange',onVisibility)}
    })
    // Autosave reacts only to a changed draft, not to save-error publications.
    scope.effect(()=>{
      let timer:ReturnType<typeof setTimeout>|undefined, signature=''
      const sync=()=>{const n=notes.getSnapshot();if(n.busy){clearTimeout(timer);return}const key=JSON.stringify(n.draft);if(key===signature)return;signature=key;clearTimeout(timer);if(n.dirty&&!n.busy&&(n.draft?.title.trim()||n.draft?.body.trim()))timer=setTimeout(()=>{void notes.save()},350)}
      const offNotes=notes.subscribe(sync)
      return()=>{clearTimeout(timer);offNotes()}
    })
    scope.slots.inject('main',function*(){
      yield scope.slots.register({name:'main',key:PANEL},()=> <Surface exportBookmarks={exportBookmarks} bookmarks={bookmarks} port={port} notes={notes} settings={settings} noteSettings={noteSettings} runner={runner}/>)
      yield ()=>{if(scope.layout.panelInfo.getSnapshot().activePanelId===PANEL)scope.layout.selectPanel(null)}
    })
    scope.slots.inject('sidebar.panellist',()=>scope.slots.register({name:'sidebar.panellist',id:PANEL,order:20,label:'AppHub'},HubIcon))
  })
}
