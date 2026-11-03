import { randomUUID, createHash } from 'node:crypto'
import { readHub } from './hub.ts'
import { createNotesService, nextNoteColor } from './notes.ts'
import type { NotesRepository } from './notes.ts'
import type { HubSettings, SettingsScope, SettingsResult, NoteTask, SaveNote, NoteSaveResult } from '../contracts.ts'
export interface TaskRow { id:string; sessionId:string; noteId:string; app:string; operation:string; callKey:string|null; payload:string|null; status:'pending'|'saved'|'failed' }
interface Preferences { settings():HubSettings;saveSettings(value:HubSettings):SettingsResult }
interface HubStore extends Preferences {
  prepare(id:string,sessionId:string,noteId:string):TaskRow
  task(id:string):TaskRow|undefined
  sessionTasks(sessionId:string):TaskRow[]
  claim(sessionId:string,callKey:string,payload:string,id:string,noteId:string):TaskRow
  finish(id:string,status:'saved'|'failed'):void
}
export interface TrustedCaller { sessionId:string; callId:string; operations:readonly string[] }
export class AppHubApplication {
  private hub: HubStore
  private notesRepository?: NotesRepository & Preferences
  constructor(hub:HubStore,notesRepository?:NotesRepository & Preferences) {this.hub=hub;this.notesRepository=notesRepository}
  private notes(){if(!this.notesRepository)throw Error('NOTES_UNAVAILABLE');return createNotesService(this.notesRepository)}
  read(id:string){return readHub(id)}
  settings(scope:SettingsScope){return this.preferences(scope).settings()}
  private preferences(scope:SettingsScope):Preferences {
    if(scope==='hub')return this.hub
    if(scope!=='notes')throw Error('INVALID_SCOPE')
    if(!this.notesRepository)throw Error('NOTES_UNAVAILABLE')
    return this.notesRepository
  }
  saveSettings(scope:SettingsScope,value:HubSettings):SettingsResult {
    const repository=this.preferences(scope)
    if(!value||!['host','light','dark'].includes(value.appearance)||!Number.isSafeInteger(value.revision)||value.revision<0)return {status:'invalid',settings:repository.settings()}
    return repository.saveSettings(value)
  }
  prepareTask(id:string,sessionId:string,noteId:string):NoteTask {
    if(![id,noteId].every(v=>/^[0-9a-f-]{36}$/i.test(v))||!sessionId||sessionId.length>200)throw Error('INVALID_TASK')
    this.notes()
    this.hub.prepare(id,sessionId,noteId)
    return this.getTask(id)
  }
  getTask(id:string):NoteTask {
    const task=this.hub.task(id);if(!task)throw Error('TASK_NOT_FOUND')
    const notes=this.notes().list(), rows=this.hub.sessionTasks(task.sessionId)
    const savedCount=rows.filter(row=>notes.some(n=>n.id===row.noteId)).length
    const failedCount=rows.filter(row=>row.status==='failed'&&!notes.some(n=>n.id===row.noteId)).length
    const pendingCount=rows.length-savedCount-failedCount
    const status=pendingCount?'pending':failedCount?(savedCount?'partial':'failed'):'saved'
    return {id:task.id,sessionId:task.sessionId,noteId:task.noteId,status,savedCount,failedCount,pendingCount,note:notes.find(n=>n.id===task.noteId)}
  }
  listNotes(){return this.notes().list()}
  saveNote(input:SaveNote):NoteSaveResult {try{return this.notes().save(input)}catch{return {status:'unavailable'}}}
  // This context is supplied by the trusted adapter, never included in model parameters.
  dispatch(operation:string,args:unknown,caller:TrustedCaller) {
    if(!caller.sessionId||!caller.callId||!caller.operations.includes(operation))throw Error('FORBIDDEN')
    if(operation!=='notes.create')throw Error('UNKNOWN_OPERATION')
    if(!args||typeof args!=='object'||Array.isArray(args))throw Error('INVALID_ARGUMENTS')
    const fields=args as Record<string,unknown>
    if(Object.keys(fields).some(key=>!['title','body'].includes(key))||typeof fields.title!=='string'||typeof fields.body!=='string'||fields.title.length>200||fields.body.length>100000||(!fields.title.trim()&&!fields.body.trim()))throw Error('INVALID_ARGUMENTS')
    const notes=this.notes()
    const payload=createHash('sha256').update(JSON.stringify([fields.title,fields.body])).digest('hex')
    const key=JSON.stringify([caller.sessionId,caller.callId])
    const task=this.hub.claim(caller.sessionId,key,payload,randomUUID(),randomUUID())
    try {
      // A committed note is authoritative even when the previous task acknowledgement was lost.
      if(!notes.list().some(n=>n.id===task.noteId)) {
        const result=notes.save({id:task.noteId,title:fields.title,body:fields.body,expectedRevision:0,color:nextNoteColor(notes.list())})
        if(result.status!=='saved')throw Error('NOTE_SAVE_'+result.status.toUpperCase())
      }
      this.hub.finish(task.id,'saved')
      return {status:'saved' as const,noteId:task.noteId}
    }catch(error){this.hub.finish(task.id,'failed');throw error}
  }
}
