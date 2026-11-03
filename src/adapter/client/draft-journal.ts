import type { SaveNote } from '../../contracts.ts'
import type { DraftJournal } from '../../application/notes-controller.ts'
const prefix='dsh-apphub:notes:unsaved:v1:'
// Only unacknowledged edits live here. The notes database remains authoritative.
export function createDraftJournal(storage:Storage):DraftJournal {
  return {
    list(){
      const drafts:SaveNote[]=[]
      for(let i=0;i<storage.length;i++){
        const key=storage.key(i);if(!key?.startsWith(prefix))continue
        try{
          const d=JSON.parse(storage.getItem(key)??'null') as SaveNote
          if(d&&typeof d.id==='string'&&key===prefix+d.id&&typeof d.title==='string'&&typeof d.body==='string'&&Number.isSafeInteger(d.expectedRevision)&&d.expectedRevision>=0&&d.title.length<=200&&d.body.length<=100000)drafts.push(d)
        }catch{/* Leave unreadable records untouched, never interpret them as saved notes. */}
      }
      return drafts
    },
    write(draft){storage.setItem(prefix+draft.id,JSON.stringify(draft))},
    remove(id){storage.removeItem(prefix+id)},
  }
}
