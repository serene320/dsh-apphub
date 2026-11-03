import {DatabaseSync} from 'node:sqlite'
import {randomUUID} from 'node:crypto'
import type {Bookmark,BookmarkInput,BookmarkResult,BookmarkImportItem,BookmarkImportResult,BookmarkPage,BookmarkAiItem,BookmarkAiResult,BookmarkPreview} from '../../contracts.ts'
import type {BookmarksRepository} from '../../application/bookmarks.ts'
export class SqliteBookmarksRepository implements BookmarksRepository {
  private db:DatabaseSync
  constructor(path:string){
    this.db=new DatabaseSync(path)
    try{this.db.exec('PRAGMA busy_timeout=3000');const version=(this.db.prepare('PRAGMA user_version').get() as {user_version:number}).user_version;if(version>2)throw Error('Unsupported bookmarks schema')
    this.db.exec('BEGIN IMMEDIATE')
    this.db.exec(`CREATE TABLE IF NOT EXISTS bookmarks(id TEXT PRIMARY KEY,url TEXT NOT NULL UNIQUE,title TEXT NOT NULL,description TEXT NOT NULL,tags TEXT NOT NULL,collections TEXT NOT NULL,revision INTEGER NOT NULL,createdAt TEXT NOT NULL,updatedAt TEXT NOT NULL,deletedAt TEXT,source TEXT NOT NULL)` )
    if(version<2){this.db.exec("ALTER TABLE bookmarks ADD COLUMN aiSummary TEXT NOT NULL DEFAULT ''; ALTER TABLE bookmarks ADD COLUMN sources TEXT NOT NULL DEFAULT '[]'; ALTER TABLE bookmarks ADD COLUMN preview TEXT")}
    this.db.exec("CREATE TABLE IF NOT EXISTS ai_calls(sessionId TEXT NOT NULL,callId TEXT NOT NULL,payload TEXT NOT NULL,result TEXT NOT NULL,PRIMARY KEY(sessionId,callId));CREATE TABLE IF NOT EXISTS preview_media(id TEXT PRIMARY KEY,mime TEXT NOT NULL,body BLOB NOT NULL,usedAt TEXT NOT NULL);PRAGMA user_version=2;COMMIT")
    }catch(e){try{this.db.exec('ROLLBACK')}catch{}this.db.close();throw e}
  }
  private decode(row:unknown):Bookmark|undefined{if(!row)return;const r=row as Bookmark&{tags:string;collections:string;sources:string;preview:string|null};return {...r,tags:JSON.parse(r.tags),collections:JSON.parse(r.collections),sources:JSON.parse(r.sources),preview:r.preview?JSON.parse(r.preview):undefined}}
  private byId(id:string){return this.decode(this.db.prepare('SELECT * FROM bookmarks WHERE id=?').get(id))}
  private byUrl(url:string){return this.decode(this.db.prepare('SELECT * FROM bookmarks WHERE url=?').get(url))}
  list(){return this.db.prepare('SELECT * FROM bookmarks WHERE deletedAt IS NULL ORDER BY updatedAt DESC,id').all().map(r=>this.decode(r)!)}
  private write(b:Bookmark){this.db.prepare(`INSERT INTO bookmarks(id,url,title,description,tags,collections,revision,createdAt,updatedAt,deletedAt,source,aiSummary,sources) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET url=excluded.url,title=excluded.title,description=excluded.description,tags=excluded.tags,collections=excluded.collections,revision=excluded.revision,updatedAt=excluded.updatedAt,deletedAt=excluded.deletedAt,source=excluded.source,aiSummary=excluded.aiSummary,sources=excluded.sources`).run(b.id,b.url,b.title,b.description,JSON.stringify(b.tags),JSON.stringify(b.collections),b.revision,b.createdAt,b.updatedAt,b.deletedAt,b.source,b.aiSummary??'',JSON.stringify(b.sources??[]))}
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
      const bookmark:Bookmark={id:previous?.id??input.id,url:input.url,title:input.title,description:input.description,tags:input.tags,collections:input.collections,revision:(previous?.revision??0)+1,createdAt:previous?.createdAt??now,updatedAt:now,deletedAt:null,source:previous?.source??'manual',aiSummary:previous?.aiSummary,sources:previous?.sources}
      if(old&&duplicate&&duplicate.id!==old.id){this.db.exec('COMMIT');return {status:'duplicate',bookmark:duplicate}}
      this.write(bookmark);if(old&&old.url!==bookmark.url)this.db.prepare('UPDATE bookmarks SET preview=NULL WHERE id=?').run(bookmark.id);this.db.exec('COMMIT');return {status:'saved',bookmark}
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
  page(query:string,collection:string,offset:number,limit:number):BookmarkPage {
    const where="deletedAt IS NULL AND (?='' OR instr(lower(title||' '||url||' '||description||' '||aiSummary||' '||tags),lower(?))>0) AND (?='' OR EXISTS(SELECT 1 FROM json_each(bookmarks.collections) WHERE value=?))"
    const args=[query,query,collection,collection]
    const total=Number(this.db.prepare('SELECT count(*) AS n FROM bookmarks WHERE '+where).get(...args)!.n)
    const items=this.db.prepare('SELECT * FROM bookmarks WHERE '+where+' ORDER BY updatedAt DESC,id LIMIT ? OFFSET ?').all(...args,limit,offset).map(r=>this.decode(r)!)
    const collections=this.db.prepare('SELECT DISTINCT value FROM bookmarks,json_each(bookmarks.collections) WHERE deletedAt IS NULL ORDER BY value').all().map(r=>String(r.value))
    return {items,total,collections,offset}
  }
  preview(id:string,url:string,value:BookmarkPreview){this.db.prepare('UPDATE bookmarks SET preview=? WHERE id=? AND url=? AND deletedAt IS NULL').run(JSON.stringify(value),id,url)}
  find(id:string){return this.byId(id)}
  ai(sessionId:string,callId:string,payload:string,items:BookmarkAiItem[],organize?:{id:string;revision:number;collections:string[];tags:string[]}):BookmarkAiResult {
    this.db.exec('BEGIN IMMEDIATE')
    try {
      const previous=this.db.prepare('SELECT payload,result FROM ai_calls WHERE sessionId=? AND callId=?').get(sessionId,callId)
      if(previous){if(previous.payload!==payload)throw Error('REQUEST_CONFLICT');this.db.exec('COMMIT');return JSON.parse(String(previous.result))}
      const result:BookmarkAiResult={results:[]}
      if(organize){
        const old=this.byId(organize.id)
        if(!old||old.deletedAt||old.revision!==organize.revision)result.results.push({url:old?.url??'',status:'failed',error:'版本冲突或收藏不存在'})
        else{this.write({...old,collections:organize.collections,tags:organize.tags,revision:old.revision+1,updatedAt:new Date().toISOString()});result.results.push({url:old.url,id:old.id,status:'updated'})}
      }
      for(const item of items){
        const old=this.byUrl(item.url)
        if(old){result.results.push({url:item.url,id:old.id,status:old.deletedAt?'failed':'existing',...(old.deletedAt?{error:'此链接已被移除，不自动恢复'}:{})});continue}
        const now=new Date().toISOString(),id=randomUUID()
        this.write({id,url:item.url,title:item.title,description:'',tags:item.tags,collections:item.collections,aiSummary:item.summary,sources:item.sources,revision:1,createdAt:now,updatedAt:now,deletedAt:null,source:'ai'})
        result.results.push({url:item.url,id,status:'created'})
      }
      this.db.prepare('INSERT INTO ai_calls VALUES(?,?,?,?)').run(sessionId,callId,payload,JSON.stringify(result));this.db.exec('COMMIT');return result
    }catch(error){this.db.exec('ROLLBACK');throw error}
  }
  failure(sessionId:string,callId:string,payload:string,message:string){
    const result:BookmarkAiResult={results:[{url:'',status:'failed',error:message.slice(0,200)}]}
    this.db.prepare('INSERT OR IGNORE INTO ai_calls VALUES(?,?,?,?)').run(sessionId,callId,payload,JSON.stringify(result))
  }
  summary(sessionId:string){
    let savedCount=0,existingCount=0,failedCount=0,updatedCount=0,createdCount=0
    for(const row of this.db.prepare('SELECT result FROM ai_calls WHERE sessionId=?').all(sessionId)){
      for(const r of (JSON.parse(String(row.result)) as BookmarkAiResult).results){if(r.status==='failed')failedCount++;else if(r.status==='existing')existingCount++;else{savedCount++;if(r.status==='updated')updatedCount++;else createdCount++}}
    }
    return {savedCount,existingCount,failedCount,updatedCount,createdCount}
  }
  putMedia(id:string,mime:string,body:Buffer){
    this.db.prepare('INSERT OR REPLACE INTO preview_media VALUES(?,?,?,?)').run(id,mime,body,new Date().toISOString())
    this.db.exec('DELETE FROM preview_media WHERE id NOT IN(SELECT id FROM preview_media ORDER BY usedAt DESC LIMIT 256)')
  }
  media(id:string){const value=this.db.prepare('SELECT mime,body FROM preview_media WHERE id=?').get(id) as {mime:string;body:Uint8Array}|undefined;if(value)this.db.prepare('UPDATE preview_media SET usedAt=? WHERE id=?').run(new Date().toISOString(),id);return value}
  close(){this.db.close()}
}
