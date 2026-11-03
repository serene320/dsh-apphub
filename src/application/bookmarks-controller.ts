import type {Bookmark,BookmarkInput,BookmarkResult,BookmarkImportPreview,BookmarkImportResult,BookmarkPage} from '../contracts.ts'
export interface BookmarksPort {
 refreshPreview?(id:string):Promise<void>;query?(query:string,collection:string,offset:number):Promise<BookmarkPage>; list():Promise<Bookmark[]>;save(input:BookmarkInput):Promise<BookmarkResult>;remove(id:string,revision:number):Promise<boolean>
 preview(html:string):Promise<BookmarkImportPreview>;importHtml(html:string):Promise<BookmarkImportResult>
}
export function createBookmarksController(port:BookmarksPort){
 let state={items:[] as Bookmark[],total:0,collections:[] as string[],query:'',collection:'',offset:0,loaded:false,busy:false,error:'',importPreview:null as BookmarkImportPreview|null,importResult:null as BookmarkImportResult|null},html='',disposed=false,loadVersion=0,filterTimer:ReturnType<typeof setTimeout>|undefined,previewTimer:ReturnType<typeof setTimeout>|undefined
 const listeners=new Set<()=>void>(),publish=()=>{if(disposed)return;state={...state};listeners.forEach(f=>f())}
 const error=(e:unknown)=>e instanceof Error?e.message:'操作失败，请重试。'
 async function load(){const version=++loadVersion;try{const page=port.query?await port.query(state.query,state.collection,state.offset):null;const items=page?.items??await port.list();if(disposed||version!==loadVersion)return;state.items=items;state.total=page?.total??items.length;state.collections=page?.collections??[...new Set(items.flatMap(b=>b.collections))];state.loaded=true;state.error='';publish();clearTimeout(previewTimer);if(port.query&&items.some(b=>!b.preview||b.preview.checkedAt==='1970-01-01T00:00:00.000Z'))previewTimer=setTimeout(()=>{void load()},2500)}catch(e){if(disposed||version!==loadVersion)return;state.error=error(e);publish()}}
 async function action<T>(fn:()=>Promise<T>){if(state.busy||disposed)return;loadVersion++;state.busy=true;state.error='';publish();try{return await fn()}catch(e){state.error=error(e);return undefined}finally{state.busy=false;publish()}}
 return {
 getSnapshot:()=>state,
 refreshPreview(id:string){return action(async()=>{await port.refreshPreview?.(id);await load();previewTimer=setTimeout(()=>{void load()},3000)})},
 filter(query:string,collection:string){state.query=query;state.collection=collection;state.offset=0;loadVersion++;publish();clearTimeout(filterTimer);filterTimer=setTimeout(()=>{void load()},200)},
 page(offset:number){state.offset=Math.max(0,offset);publish();void load()},subscribe(f:()=>void){listeners.add(f);return()=>{listeners.delete(f)}},load,
 async save(input:BookmarkInput){return action(async()=>{const result=await port.save(input);if(result.status!=='saved'){state.error=result.status==='duplicate'?'这个链接已经收藏。':result.status==='conflict'?'收藏已被修改，请关闭后重新打开。':'收藏内容无效。';return false}state.items=[result.bookmark!,...state.items.filter(b=>b.id!==result.bookmark!.id)];await load();return true})},
 async remove(item:Bookmark){return action(async()=>{if(!await port.remove(item.id,item.revision)){state.error='收藏已被修改，请刷新后重试。';return false}state.items=state.items.filter(b=>b.id!==item.id);await load();return true})},
 preview(value:string){return action(async()=>{const preview=await port.preview(value);html=value;state.importPreview=preview;state.importResult=null})},
 importHtml(){return action(async()=>{if(!state.importPreview)throw Error('请先选择书签文件。');state.importResult=await port.importHtml(html);state.importPreview=null;html='';await load()})},
 clearImport(){if(state.busy)return;state.importPreview=null;state.importResult=null;html='';publish()},
 reportError(message:string){state.error=message;publish()},
 dispose(){disposed=true;clearTimeout(filterTimer);clearTimeout(previewTimer);loadVersion++;html='';listeners.clear()},
 }
}
