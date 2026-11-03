import type { Bookmark, BookmarkInput, BookmarkResult, BookmarkImportItem, BookmarkImportResult } from '../contracts.ts'
export interface BookmarksRepository {
  list():Bookmark[]
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
    save:(input:BookmarkInput)=>repository.save(validateBookmark(input)),
    remove(id:string,revision:number){if(!/^[0-9a-f-]{36}$/i.test(id)||!Number.isSafeInteger(revision)||revision<1)throw Error('收藏版本无效。');return repository.remove(id,revision)},
    importItems(items:BookmarkImportItem[]){
      if(!Array.isArray(items)||items.length>10000)throw Error('每次最多导入 10000 条收藏。')
      const valid=items.map(i=>{const b=validateBookmark({id:'00000000-0000-4000-8000-000000000000',url:i.url,title:i.title,description:'',collections:i.collections,tags:[],expectedRevision:0});return {url:b.url,title:b.title,collections:b.collections}})
      return repository.importItems(valid)
    },
  }
}
