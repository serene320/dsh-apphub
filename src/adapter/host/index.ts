import { defineTool } from '@deepseek-ai/dsh-tools'
import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { openAppHub } from '../storage/open-apphub.ts'
import type { AppHubApplication } from '../../application/apphub-service.ts'
import type { SettingsScope, HubSettings, SettingsResult, NoteTask, Note, SaveNote, NoteSaveResult } from '../../contracts.ts'
import type { HubSnapshot } from '../../contracts.ts'
export type { HubSnapshot, AppSummary } from '../../contracts.ts'

declare module '@deepseek-ai/cordis' {
  interface Context { apphub: AppHubService }
}
export class AppHubService extends TypertRemoteService {
  private application: AppHubApplication
  constructor(ctx: Context) {
    super(ctx, 'apphub')
    const runtime = openAppHub(join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'apphub'))
    this.application = runtime.service
    ctx.effect(() => () => runtime.close())
    ctx.inject(['tools'], toolContext => {
      toolContext.tools.register(defineTool({
        name: 'apphub_create_note',
        description: 'Save a new note in AppHub from the current conversation. Returns a saved note ID only after persistence. Do not use filesystem tools to write notes.',
        parameters: { title: {type:'string',required:true,description:'Concise note title'}, body: {type:'string',required:true,description:'Complete note text'} },
        output: {schema:{type:'string'},render: (_args, value) => [{type:'text',text:value}]},
        execute: async (args, exec) => {
          exec.signal.throwIfAborted()
          if (!exec.agent || !exec.callId) throw Error('FORBIDDEN')
          return JSON.stringify(this.application.dispatch('notes.create', args, {
            sessionId: exec.agent.id, callId: exec.callId, operations: ['notes.create'],
          }))
        },
        presentCall: args => ({card:'generic',title:'保存到 AppHub 备忘录',rawInput:args}),
      }))
    })
  }
  @Remote('settings')
  settings(scope: SettingsScope, signal: AbortSignal): HubSettings { signal.throwIfAborted(); return this.application.settings(scope) }
  @Remote('saveSettings')
  saveSettings(scope: SettingsScope, value: HubSettings, signal: AbortSignal): SettingsResult { signal.throwIfAborted(); return this.application.saveSettings(scope,value) }
  @Remote('prepareTask')
  prepareTask(id: string, sessionId: string, noteId: string, signal: AbortSignal): NoteTask { signal.throwIfAborted(); return this.application.prepareTask(id,sessionId,noteId) }
  @Remote('getTask')
  getTask(id: string, signal: AbortSignal): NoteTask { signal.throwIfAborted(); return this.application.getTask(id) }
  @Remote('listNotes')
  listNotes(signal: AbortSignal): Note[] { signal.throwIfAborted(); return this.application.listNotes() }
  @Remote('saveNote')
  saveNote(input: SaveNote, signal: AbortSignal): NoteSaveResult { signal.throwIfAborted(); return this.application.saveNote(input) }
  @Remote('read')
  read(requestId: string, signal: AbortSignal): HubSnapshot { signal.throwIfAborted(); return this.application.read(requestId) }
}
export function apply(ctx: Context): void { ctx.plugin(AppHubService) }
