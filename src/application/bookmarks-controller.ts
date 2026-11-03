import type {Bookmark,BookmarkInput,BookmarkResult,BookmarkImportPreview,BookmarkImportResult} from '../contracts.ts'
export interface BookmarksPort {
 list():Promise<Bookmark[]>;save(input:BookmarkInput):Promise<BookmarkResult>;remove(id:string,revision:number):Promise<boolean>
 preview(html:string):Promise<BookmarkImportPreview>;importHtml(html:string):Promise<BookmarkImportResult>
}
export function createBookmarksController(port:BookmarksPort){
 let state={items:[] as Bookmark[],loaded:false,busy:false,error:'',importPreview:null as BookmarkImportPreview|null,importResult:null as BookmarkImportResult|null},html='',disposed=false,loadVersion=0
 const listeners=new Set<()=>void>(),publish=()=>{if(disposed)return;state={...state};listeners.forEach(f=>f())}
 const error=(e:unknown)=>e instanceof Error?e.message:'操作失败，请重试。'
 async function load(){const version=++loadVersion;try{const items=await port.list();if(disposed||version!==loadVersion)return;state.items=items;state.loaded=true;state.error='';publish()}catch(e){if(disposed||version!==loadVersion)return;state.error=error(e);publish()}}
 async function action<T>(fn:()=>Promise<T>){if(state.busy||disposed)return;loadVersion++;state.busy=true;state.error='';publish();try{return await fn()}catch(e){state.error=error(e);return undefined}finally{state.busy=false;publish()}}
 return {
 getSnapshot:()=>state,subscribe(f:()=>void){listeners.add(f);return()=>{listeners.delete(f)}},load,
 async save(input:BookmarkInput){return action(async()=>{const result=await port.save(input);if(result.status!=='saved'){state.error=result.status==='duplicate'?'这个链接已经收藏。':result.status==='conflict'?'收藏已被修改，请关闭后重新打开。':'收藏内容无效。';return false}state.items=[result.bookmark!,...state.items.filter(b=>b.id!==result.bookmark!.id)];return true})},
 async remove(item:Bookmark){return action(async()=>{if(!await port.remove(item.id,item.revision)){state.error='收藏已被修改，请刷新后重试。';return false}state.items=state.items.filter(b=>b.id!==item.id);return true})},
 preview(value:string){return action(async()=>{const preview=await port.preview(value);html=value;state.importPreview=preview;state.importResult=null})},
 importHtml(){return action(async()=>{if(!state.importPreview)throw Error('请先选择书签文件。');state.importResult=await port.importHtml(html);state.importPreview=null;html='';await load()})},
 clearImport(){if(state.busy)return;state.importPreview=null;state.importResult=null;html='';publish()},
 reportError(message:string){state.error=message;publish()},
 dispose(){disposed=true;loadVersion++;html='';listeners.clear()},
 }
}
