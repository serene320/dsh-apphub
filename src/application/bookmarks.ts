import type { Bookmark, BookmarkInput, BookmarkResult, BookmarkImportItem, BookmarkImportResult, BookmarkPage, BookmarkAiItem, BookmarkAiResult, BookmarkPreview } from '../contracts.ts'
export interface BookmarksRepository {
  list():Bookmark[]
  page(query:string,collection:string,offset:number,limit:number):BookmarkPage
  find(id:string):Bookmark|undefined
  preview(id:string,url:string,value:BookmarkPreview):void
  ai(sessionId:string,callId:string,payload:string,items:BookmarkAiItem[],organize?:{id:string;revision:number;collections:string[];tags:string[]}):BookmarkAiResult
  failure(sessionId:string,callId:string,payload:string,message:string):void
  summary(sessionId:string):{savedCount:number;existingCount:number;failedCount:number;updatedCount:number;createdCount:number}
  save(input:BookmarkInput):BookmarkResult
  remove(id:string,revision:number):boolean
  importItems(items:BookmarkImportItem[]):BookmarkImportResult
}
export function bookmarkUrl(value:string):string {
  if(typeof value!=='string'||value.length>4096)throw Error('链接过长。')
  let url:URL
  try{url=new URL(value.trim())}catch{throw Error('请输入完整的 http 或 https 链接。')}
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw Error('仅支持不含账号密码的 http 或 https 链接。')
  return url.href
}
export function validateBookmark(input:BookmarkInput):BookmarkInput {
  if(!input||!(/^[0-9a-f-]{36}$/i.test(input.id))||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0)throw Error('收藏版本无效。')
  const url=bookmarkUrl(input.url)
  if(typeof input.title!=='string'||input.title.length>300||typeof input.description!=='string'||input.description.length>5000)throw Error('标题或说明过长。')
  const clean=(items:string[],limit:number)=>{if(!Array.isArray(items)||items.length>limit||items.some(v=>typeof v!=='string'||v.length>300))throw Error('标签或集合无效。');return [...new Set(items.map(v=>v.trim()).filter(Boolean))]}
  return {...input,url,title:input.title.trim()||new URL(url).hostname,description:input.description.trim(),tags:clean(input.tags,30),collections:clean(input.collections,30)}
}
export function createBookmarksService(repository:BookmarksRepository) {
  return {
    list:()=>repository.list(),
    find:(id:string)=>repository.find(id),
    preview:(id:string,url:string,value:BookmarkPreview)=>repository.preview(id,url,value),
    page(query:string,collection:string,offset:number,limit=60){
      if(typeof query!=='string'||query.length>300||typeof collection!=='string'||collection.length>300||!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>60)throw Error('查询参数无效')
      return repository.page(query.trim(),collection,offset,limit)
    },
    summary:(sessionId:string)=>repository.summary(sessionId),
    dispatch(operation:string,args:unknown,caller:{sessionId:string;callId:string;operations:readonly string[]}){
      if(!caller.sessionId||!caller.callId||!caller.operations.includes(operation))throw Error('FORBIDDEN')
      try{
      if(!args||typeof args!=='object'||Array.isArray(args))throw Error('INVALID_ARGUMENTS')
      const a=args as Record<string,unknown>
      if(operation==='bookmarks.create'){
        if(!Array.isArray(a.items)||!a.items.length||a.items.length>20)throw Error('每批需要 1–20 条链接，请分批保存。')
        const items:BookmarkAiItem[]=a.items.map(raw=>{
          const item=raw as BookmarkAiItem
          const b=validateBookmark({id:'00000000-0000-4000-8000-000000000000',expectedRevision:0,url:item.url,title:item.title,description:'',tags:item.tags,collections:item.collections})
          if(typeof item.summary!=='string'||item.summary.length>1000||!Array.isArray(item.sources)||item.sources.length>5)throw Error('摘要或来源无效')
          return {url:b.url,title:b.title,tags:b.tags,collections:b.collections,summary:item.summary.trim(),sources:item.sources.map(bookmarkUrl)}
        })
        return repository.ai(caller.sessionId,caller.callId,JSON.stringify([operation,items]),items)
      }
      if(operation==='bookmarks.organize'){
        const b=validateBookmark({id:a.id as string,expectedRevision:a.revision as number,url:'https://example.com',title:'',description:'',tags:a.tags as string[],collections:a.collections as string[]})
        const value={id:b.id,revision:b.expectedRevision,tags:b.tags,collections:b.collections}
        return repository.ai(caller.sessionId,caller.callId,JSON.stringify([operation,value]),[],value)
      }
      throw Error('UNKNOWN_OPERATION')
      }catch(error){repository.failure(caller.sessionId,caller.callId,JSON.stringify([operation,args]).slice(0,50000),error instanceof Error?error.message:'保存失败');throw error}
    },
    save:(input:BookmarkInput)=>repository.save(validateBookmark(input)),
    remove(id:string,revision:number){if(!/^[0-9a-f-]{36}$/i.test(id)||!Number.isSafeInteger(revision)||revision<1)throw Error('收藏版本无效。');return repository.remove(id,revision)},
    importItems(items:BookmarkImportItem[]){
      if(!Array.isArray(items)||items.length>10000)throw Error('每次最多导入 10000 条收藏。')
      const valid=items.map(i=>{const b=validateBookmark({id:'00000000-0000-4000-8000-000000000000',url:i.url,title:i.title,description:'',collections:i.collections,tags:[],expectedRevision:0});return {url:b.url,title:b.title,collections:b.collections}})
      return repository.importItems(valid)
    },
  }
}
