import {DatabaseSync} from 'node:sqlite'
import {randomUUID} from 'node:crypto'
import type {Bookmark,BookmarkInput,BookmarkResult,BookmarkImportItem,BookmarkImportResult} from '../../contracts.ts'
import type {BookmarksRepository} from '../../application/bookmarks.ts'
export class SqliteBookmarksRepository implements BookmarksRepository {
  private db:DatabaseSync
  constructor(path:string){
    this.db=new DatabaseSync(path)
    try{this.db.exec('PRAGMA busy_timeout=3000');const version=(this.db.prepare('PRAGMA user_version').get() as {user_version:number}).user_version;if(version>1)throw Error('Unsupported bookmarks schema')
    this.db.exec(`CREATE TABLE IF NOT EXISTS bookmarks(id TEXT PRIMARY KEY,url TEXT NOT NULL UNIQUE,title TEXT NOT NULL,description TEXT NOT NULL,tags TEXT NOT NULL,collections TEXT NOT NULL,revision INTEGER NOT NULL,createdAt TEXT NOT NULL,updatedAt TEXT NOT NULL,deletedAt TEXT,source TEXT NOT NULL);PRAGMA user_version=1`)
    }catch(e){this.db.close();throw e}
  }
  private decode(row:unknown):Bookmark|undefined{if(!row)return;const r=row as Bookmark&{tags:string;collections:string};return {...r,tags:JSON.parse(r.tags),collections:JSON.parse(r.collections)}}
  private byId(id:string){return this.decode(this.db.prepare('SELECT * FROM bookmarks WHERE id=?').get(id))}
  private byUrl(url:string){return this.decode(this.db.prepare('SELECT * FROM bookmarks WHERE url=?').get(url))}
  list(){return this.db.prepare('SELECT * FROM bookmarks WHERE deletedAt IS NULL ORDER BY updatedAt DESC,id').all().map(r=>this.decode(r)!)}
  private write(b:Bookmark){this.db.prepare(`INSERT INTO bookmarks VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET url=excluded.url,title=excluded.title,description=excluded.description,tags=excluded.tags,collections=excluded.collections,revision=excluded.revision,updatedAt=excluded.updatedAt,deletedAt=excluded.deletedAt,source=excluded.source`).run(b.id,b.url,b.title,b.description,JSON.stringify(b.tags),JSON.stringify(b.collections),b.revision,b.createdAt,b.updatedAt,b.deletedAt,b.source)}
  save(input:BookmarkInput):BookmarkResult {
    this.db.exec('BEGIN IMMEDIATE')
    try{
      const old=this.byId(input.id), duplicate=this.byUrl(input.url)
      if(duplicate&&duplicate.id!==input.id&&!duplicate.deletedAt){this.db.exec('COMMIT');return {status:'duplicate',bookmark:duplicate}}
      if(old&&!old.deletedAt&&old.revision===input.expectedRevision+1&&old.url===input.url&&old.title===input.title&&old.description===input.description&&JSON.stringify(old.tags)===JSON.stringify(input.tags)&&JSON.stringify(old.collections)===JSON.stringify(input.collections)){this.db.exec('COMMIT');return {status:'saved',bookmark:old}}
      if(old?.deletedAt||(old?.revision??0)!==input.expectedRevision){this.db.exec('COMMIT');return {status:'conflict'}}
      // Explicit manual re-add revives a tombstone. Import never revives deleted entries.
      const previous=old??duplicate
      const now=new Date().toISOString()
      const bookmark:Bookmark={id:previous?.id??input.id,url:input.url,title:input.title,description:input.description,tags:input.tags,collections:input.collections,revision:(previous?.revision??0)+1,createdAt:previous?.createdAt??now,updatedAt:now,deletedAt:null,source:previous?.source??'manual'}
      if(old&&duplicate&&duplicate.id!==old.id){this.db.exec('COMMIT');return {status:'duplicate',bookmark:duplicate}}
      this.write(bookmark);this.db.exec('COMMIT');return {status:'saved',bookmark}
    }catch(e){this.db.exec('ROLLBACK');throw e}
  }
  remove(id:string,revision:number){const now=new Date().toISOString();return this.db.prepare('UPDATE bookmarks SET deletedAt=?,updatedAt=?,revision=revision+1 WHERE id=? AND revision=? AND deletedAt IS NULL').run(now,now,id,revision).changes===1}
  importItems(items:BookmarkImportItem[]):BookmarkImportResult {
    const result={added:0,duplicates:0,skipped:0};this.db.exec('BEGIN IMMEDIATE')
    try{for(const item of items){const old=this.byUrl(item.url);if(old){result.duplicates++;if(old.deletedAt)continue;const collections=[...new Set([...old.collections,...item.collections])];if(JSON.stringify(collections)!==JSON.stringify(old.collections))this.write({...old,collections,revision:old.revision+1,updatedAt:new Date().toISOString()});continue}
      const now=new Date().toISOString();this.write({id:randomUUID(),...item,description:'',tags:[],revision:1,createdAt:now,updatedAt:now,deletedAt:null,source:'chrome-html'});result.added++}
      this.db.exec('COMMIT');return result
    }catch(e){this.db.exec('ROLLBACK');throw e}
  }
  close(){this.db.close()}
}
