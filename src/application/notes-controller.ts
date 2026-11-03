import { nextNoteColor } from './notes.ts'
import type { Note, SaveNote, NoteSaveResult } from '../contracts.ts'
export interface NotesPort {
  list(signal: AbortSignal): Promise<Note[]>
  save(input: SaveNote, signal: AbortSignal): Promise<NoteSaveResult>
}
export interface DraftJournal { list():SaveNote[]; write(draft:SaveNote):void; remove(id:string):void }
export interface NotesState {
  recoverable: SaveNote[]
  recoveryError: string
  loadError: string
  notes: Note[]
  draft?: SaveNote
  saveFailed?: boolean
  dirty: boolean
  busy: boolean
  loaded: boolean
  message: string
}
export function createNotesController(port: NotesPort, journal?: DraftJournal) {
  let state: NotesState = { recoverable: [], recoveryError: '', loadError: '', notes: [], dirty: false, busy: false, loaded: false, message: '' }
  let disposed = false
  const listeners = new Set<() => void>()
  let active: AbortController | undefined
  const publish = (next: Partial<NotesState>) => {
    if (disposed) return
    const previous=state.draft
    state = { ...state, ...next }
    if(journal && ('draft' in next || 'dirty' in next)) {
      try {
        if(state.dirty&&state.draft) journal.write(state.draft)
        else if(previous) journal.remove(previous.id)
        state.recoveryError=''
      }catch { state.recoveryError='本地草稿保护失败，请保持窗口打开直到保存成功。' }
    }
    listeners.forEach(f => f())
  }
  const sameContent=(a:SaveNote,b:Note)=>a.title===b.title&&a.body===b.body&&a.color===b.color&&!!a.pinned===!!b.pinned&&!!a.archived===!!b.archived
  const recoveries=(notes:Note[])=>{
    if(!journal)return []
    try { return journal.list().filter(d=>{
      const saved=notes.find(n=>n.id===d.id)
      if(saved&&sameContent(d,saved)){journal.remove(d.id);return false}
      return d.id!==state.draft?.id
    }) }catch {publish({recoveryError:'无法读取本地草稿，请稍后重试。'});return state.recoverable}
  }
  async function call<T>(fn: (signal: AbortSignal) => Promise<T>) {
    const controller = new AbortController(); active = controller
    let timer: ReturnType<typeof setTimeout> | undefined
    try { return await Promise.race([fn(controller.signal), new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('timeout')) }, 8000) })]) }
    finally { clearTimeout(timer); active = undefined }
  }
  const canLeave = () => { if (state.dirty || state.busy) { publish({ message: '当前便签尚未保存，请稍后再切换。' }); return false } return true }
  async function persist(input: SaveNote, archived?: boolean) {
      publish({ busy: true, saveFailed: false, message: '正在保存…' })
      try {
        const result = await call(signal => port.save(input, signal))
        if (result.status !== 'saved' || !result.note) {
          publish({ saveFailed: archived === undefined, message: result.status === 'conflict' ? '这张便签已有更新，当前草稿已保留。请复制草稿后重新打开核对。' : result.status === 'invalid' ? '请填写内容；标题最多 200 字，正文最多 100000 字。' : '保存失败，草稿已保留，请重试。' }); return false
        }
        const note = result.note
        const current = archived === undefined ? state.draft! : {...state.draft!, archived}
        const changed = current.title !== input.title || current.body !== input.body || current.color !== input.color || current.pinned !== input.pinned || current.archived !== input.archived
        publish({ notes: [note, ...state.notes.filter(n => n.id !== note.id)].sort((a,b) => b.createdAt.localeCompare(a.createdAt)), draft: { ...current, expectedRevision: note.revision }, dirty: changed, message: changed ? '未保存' : '已保存到本机' }); return !changed
      } catch { publish({ saveFailed: archived === undefined, message: '尚未确认保存结果，草稿已保留，请重试。' }); return false }
      finally { publish({ busy: false }) }
    }
  return {
    getSnapshot: () => state,
    subscribe(f: () => void) { listeners.add(f); return () => { listeners.delete(f) } },
    canLeave,
    async load() {
      if (state.busy || state.dirty || disposed) return
      publish({ busy: true, loadError: '', message: '正在读取…' })
      try { const notes = await call(signal => port.list(signal)); publish({ notes, loaded: true, recoverable:recoveries(notes), message: '' }) }
      catch { publish({ loadError: '读取失败，请重试。', message: '读取失败，请重试。' }) }
      finally { publish({ busy: false }) }
    },
    restore(id:string) {
      if(!canLeave()||!state.loaded)return false
      const draft=state.recoverable.find(d=>d.id===id)
      if(!draft)return false
      const current=state.notes.find(n=>n.id===id)
      const conflict=current?current.revision!==draft.expectedRevision:draft.expectedRevision>0
      const restored=conflict?{...draft,id:crypto.randomUUID(),expectedRevision:0,archived:false}:draft
      publish({draft:{...restored},dirty:true,saveFailed:false,recoverable:state.recoverable.filter(d=>d.id!==id),message:conflict?'已恢复为新便签':'草稿已恢复'})
      if(conflict&&!state.recoveryError){try{journal?.remove(id)}catch{/* Keep the original recovery record when removal fails. */}}
      return true
    },
    create(color = nextNoteColor(state.notes)) {
      if (!canLeave() || !state.loaded) return false
      publish({ draft: { id: crypto.randomUUID(), title: '', body: '', color, pinned:false, archived:false, expectedRevision: 0 }, dirty: false, saveFailed: false, message: '' });return true
    },
    select(id: string) {
      if (!canLeave()) return false
      const n = state.notes.find(n => n.id === id)
      if (n) publish({ draft: { id: n.id, title: n.title, body: n.body, color: n.color, pinned:!!n.pinned, archived:!!n.archived, expectedRevision: n.revision }, dirty: false, message: '已保存到本机' });return !!n
    },
    edit(field: 'title' | 'body' | 'color' | 'pinned' | 'archived', value: string | boolean) {
      if (!state.draft) return
      publish({ draft: { ...state.draft, [field]: value }, dirty: true, saveFailed: false, message: '未保存' })
    },
    async save() {
      if (disposed || state.busy) return false
      if (!state.draft || !state.dirty) return true
      return persist({...state.draft})
    },
    async setArchived(archived: boolean) {
      if (!state.draft || state.busy || disposed) return false
      return persist({...state.draft, archived}, archived)
    },
    async closeEditor() {
      if (disposed || state.busy) return false
      const draft = state.draft
      const emptyNew = draft && draft.expectedRevision === 0 && !draft.title.trim() && !draft.body.trim()
      if (!emptyNew && state.dirty && draft && !await persist({...draft})) return false
      publish({draft:undefined,dirty:false,saveFailed:false,message:''})
      return true
    },
    close() {
      if (!canLeave()) return false
      publish({draft:undefined,message:''});return true
    },
    dispose() { disposed = true; active?.abort(); listeners.clear() },
  }
}
