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
import { NotesIcon } from '../../ui/Icons.tsx'
import { Home, HubIcon } from '../../ui/Home.tsx'
import { Notes } from '../../ui/Notes.tsx'
import { Settings } from '../../ui/Settings.tsx'
import css from '../../ui/home.css'
import notesCss from '../../ui/notes.css'
import appearanceCss from '../../ui/appearance.css'

const PANEL = 'apphub' as MainPanelId
export const inject = ['slots', 'layout', 'remote', 'sessions', 'uiWorkspace']
type NotesController = ReturnType<typeof createNotesController>
type SettingsController = ReturnType<typeof createSettingsController>
type Runner = ReturnType<typeof createTaskRunner>
interface SurfaceProps { port: HubPort; notes: NotesController; settings: SettingsController; noteSettings: SettingsController; runner: Runner }
function Surface({port,notes,settings,noteSettings,runner}:SurfaceProps) {
  const [prompt,setPrompt]=useState('')
  const [home] = useState(()=>createHomeController(port))
  const [page,setPage]=useState('notes')
  const [settingsOpen,setSettingsOpen]=useState<'hub'|'notes'|null>(null), [inputError,setInputError]=useState('')
  const homeState=useSyncExternalStore(home.subscribe,home.getSnapshot)
  const notesState=useSyncExternalStore(notes.subscribe,notes.getSnapshot)
  const preferences=useSyncExternalStore(settings.subscribe,settings.getSnapshot)
  const notePreferences=useSyncExternalStore(noteSettings.subscribe,noteSettings.getSnapshot)
  const selectedSettings=settingsOpen==='notes'?noteSettings:settings
  const selectedPreferences=settingsOpen==='notes'?notePreferences:preferences
  const task=useSyncExternalStore(runner.subscribe,runner.getSnapshot)
  useEffect(()=>{void home.refresh();void notes.load();return()=>home.dispose()},[home])
  const openNotes=()=>{setPage('notes');if(!notes.getSnapshot().loaded)void notes.load()}
  const submit=async(text:string)=>{
    try {
      const command=resolveTask(text,'notes')
      setInputError('');openNotes()
      if(command.action==='open')return true
      const accepted=await runner.run(command.prompt)
      return accepted
    }catch(error){setInputError(error instanceof Error?error.message:'任务无法执行');return false}
  }
  return <div className="apphub-shell" data-appearance={page==='notes'?notePreferences.value.appearance:preferences.value.appearance}>
    <div className="hub-workspace">
    <nav className="hub-navigation" aria-label="AppHub 应用导航"><Button size="sm" variant="ghost" aria-pressed={page==='home'} onClick={()=>setPage('home')}><HubIcon size={16}/>AppHub</Button><span className="hub-navigation-label">应用</span><Button size="sm" variant="ghost" aria-pressed={page==='notes'} onClick={openNotes}><NotesIcon size={18}/>备忘录</Button></nav>
    <div className="hub-workspace-main">
    <div className="hub-workspace-content">
    {page==='home'?<Home state={homeState} onRefresh={()=>{void home.refresh()}} onOpen={openNotes} onSettings={()=>setSettingsOpen('hub')} onAppSettings={()=>setSettingsOpen('notes')} onTask={openNotes}/>:<>


      <Notes appearance={notePreferences.value.appearance} onArchive={async archived=>{const ok=await notes.setArchived(archived);if(ok)notes.close();return ok}} onCloseEditor={notes.closeEditor} state={notesState} onSettings={()=>setSettingsOpen('notes')} onCreate={()=>notes.create()} onSelect={notes.select} onEdit={notes.edit} onSave={()=>{void notes.save()}} onRestore={notes.restore} onReload={()=>{void notes.load()}}/>
    </>}
    </div>
    <TaskComposer prompt={prompt} onPromptChange={setPrompt} onSubmit={submit} taskBusy={task.busy} error={inputError} target="备忘录" activity={<TaskActivity tasks={task.tasks} onOpen={runner.openSession} onDismiss={runner.dismiss}/>}/>
    </div></div>
    {settingsOpen&&<Settings scope={settingsOpen} value={selectedPreferences.value} busy={selectedPreferences.busy} error={selectedPreferences.error} loaded={selectedPreferences.loaded} onRetry={()=>{void selectedSettings.load()}} onSave={selectedSettings.save} onClose={()=>setSettingsOpen(null)}/>}
  </div>
}
export async function apply(ctx: Context) {
  const unmountRemote = await ctx.remote.$mount(remote)
  ctx.effect(() => unmountRemote)
  const style = document.createElement('style'); style.dataset.apphub='home'; style.textContent=css+notesCss+appearanceCss
  ctx.effect(()=>{document.head.append(style);return()=>style.remove()})
  ctx.inject(['remote.apphub'], scope=>{
    const port:HubPort={read:async(id,signal)=>{const r=await scope.remote.apphub.read(id,signal);if(!r.ok)throw Error(r.error.code);return r.value}}
    const notes=createNotesController({
      list:async signal=>{const r=await scope.remote.apphub.listNotes(signal);if(!r.ok)throw Error(r.error.code);return r.value},
      save:async(input,signal)=>{const r=await scope.remote.apphub.saveNote(input,signal);if(!r.ok)throw Error(r.error.code);return r.value},
    },createDraftJournal(localStorage))
    const makeSettings=(kind:'hub'|'notes')=>createSettingsController({
      read:async()=>{const r=await scope.remote.apphub.settings(kind,new AbortController().signal);if(!r.ok)throw Error(r.error.code);return r.value},
      save:async value=>{const r=await scope.remote.apphub.saveSettings(kind,value,new AbortController().signal);if(!r.ok)throw Error(r.error.code);return r.value},
    })
    const settings=makeSettings('hub'),noteSettings=makeSettings('notes')
    void settings.load();void noteSettings.load()
    const runner=createTaskRunner(scope,notes)
    scope.effect(()=>()=>{runner.dispose();notes.dispose()})
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
      yield scope.slots.register({name:'main',key:PANEL},()=> <Surface port={port} notes={notes} settings={settings} noteSettings={noteSettings} runner={runner}/>)
      yield ()=>{if(scope.layout.panelInfo.getSnapshot().activePanelId===PANEL)scope.layout.selectPanel(null)}
    })
    scope.slots.inject('sidebar.panellist',()=>scope.slots.register({name:'sidebar.panellist',id:PANEL,order:20,label:'AppHub'},HubIcon))
  })
}
