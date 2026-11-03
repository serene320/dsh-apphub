import {SqliteBookmarksRepository} from './bookmarks-sqlite.ts'
import {createBookmarksService} from '../../application/bookmarks.ts'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { AppHubApplication } from '../../application/apphub-service.ts'
import { HubRepository } from './hub-sqlite.ts'
import { SqliteNotesRepository } from './notes-sqlite.ts'
import { migrateLegacy } from './migrate.ts'
export function openAppHub(directory:string) {
  mkdirSync(directory,{recursive:true,mode:0o700})
  const hub=new HubRepository(join(directory,'hub.sqlite'))
  let notes:SqliteNotesRepository|undefined
  let notesError:unknown
  try {
    const notesDir=join(directory,'apps','notes');mkdirSync(notesDir,{recursive:true,mode:0o700})
    const path=join(notesDir,'data.sqlite')
    const schema=new SqliteNotesRepository(path);schema.close()
    migrateLegacy(hub,join(directory,'notes.sqlite'),path)
    notes=new SqliteNotesRepository(path)
  }catch(error){notesError=error}
  let bookmarks:SqliteBookmarksRepository|undefined,bookmarksError:unknown
  try{const dir=join(directory,'apps','bookmarks');mkdirSync(dir,{recursive:true,mode:0o700});bookmarks=new SqliteBookmarksRepository(join(dir,'data.sqlite'))}catch(e){bookmarksError=e}
  return {hub,bookmarksRepository:bookmarks,bookmarks:bookmarks?createBookmarksService(bookmarks):undefined,bookmarksError,service:new AppHubApplication(hub,notes),notesError,close(){bookmarks?.close();notes?.close();hub.close()}}
}
