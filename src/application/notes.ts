import type { Note, SaveNote, NoteSaveResult } from '../contracts.ts'
export const notePapers = [{id:'cream',name:'琥珀'},{id:'sage',name:'薄荷'},{id:'rose',name:'珊瑚'},{id:'lavender',name:'淡紫'},{id:'sky',name:'天空'}] as const
export function nextNoteColor(notes: readonly Note[]): string { return notePapers[notes.filter(note=>!note.archived).length % notePapers.length]!.id }
export interface NotesRepository {
  list(): Note[]
  save(input: SaveNote): NoteSaveResult
}
export function createNotesService(repository: NotesRepository) {
  return {
    list: () => repository.list(),
    save(input: SaveNote): NoteSaveResult {
      if (!input || (input.pinned !== undefined && typeof input.pinned !== 'boolean') || (input.archived !== undefined && typeof input.archived !== 'boolean') || (input.color !== undefined && !['cream','sage','rose','lavender','sky'].includes(input.color)) || !/^[0-9a-f-]{36}$/i.test(input.id) || typeof input.title !== 'string' || typeof input.body !== 'string' ||
          input.title.length > 200 || input.body.length > 100000 || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0 ||
          (!input.title.trim() && !input.body.trim())) return { status: 'invalid' }
      return repository.save(input)
    },
  }
}
