import {previewNeedsRefresh} from './bookmark-preview.ts'
import type {Bookmark,BookmarkInput,BookmarkResult,BookmarkImportPreview,BookmarkImportResult,BookmarkPage} from '../contracts.ts'
export interface BookmarksPort {
 refreshPreview?(id:string):Promise<void>;query?(query:string,collection:string,offset:number):Promise<BookmarkPage>; list():Promise<Bookmark[]>;save(input:BookmarkInput):Promise<BookmarkResult>;remove(id:string,revision:number):Promise<boolean>
 preview(html:string):Promise<BookmarkImportPreview>;importHtml(html:string):Promise<BookmarkImportResult>
}
export function createBookmarksController(port:BookmarksPort){
 let state={items:[] as Bookmark[],total:0,collections:[] as string[],query:'',collection:'',offset:0,loaded:false,loading:false,loadingMore:false,busy:false,error:'',importPreview:null as BookmarkImportPreview|null,importResult:null as BookmarkImportResult|null},html='',disposed=false,loadVersion=0,filterTimer:ReturnType<typeof setTimeout>|undefined,previewTimer:ReturnType<typeof setTimeout>|undefined
 const listeners=new Set<()=>void>(),publish=()=>{if(disposed)return;state={...state};listeners.forEach(f=>f())}
 const error=(e:unknown)=>e instanceof Error?e.message:'操作失败，请重试。'
 function schedulePreview(){clearTimeout(previewTimer);if(port.query&&state.items.some(b=>previewNeedsRefresh(b.preview)))previewTimer=setTimeout(()=>{void load()},2500)}
 async function load(){const version=++loadVersion,query=state.query,collection=state.collection,lastOffset=state.offset;clearTimeout(previewTimer);state.loading=true;state.loadingMore=false;publish();try{
  let items:Bookmark[]=[],total=0,collections:string[]=[],offset=0
  if(port.query){for(let start=0;start<=lastOffset;start+=60){const page=await port.query(query,collection,start);if(disposed||version!==loadVersion)return;items.push(...page.items);total=page.total;collections=page.collections;offset=start;if(start+60>=total)break}}
  else{items=await port.list();total=items.length;collections=[...new Set(items.flatMap(b=>b.collections))]}
  if(disposed||version!==loadVersion)return;state.items=[...new Map(items.map(b=>[b.id,b])).values()];state.offset=offset;state.total=total;state.collections=collections;state.loaded=true;state.error='';schedulePreview()
 }catch(e){if(disposed||version!==loadVersion)return;state.error=error(e)}finally{if(!disposed&&version===loadVersion){state.loading=false;publish()}}}
 async function loadMore(){if(disposed||state.loading||state.loadingMore||state.busy||state.error||!state.loaded||state.items.length>=state.total||!port.query)return
  const version=++loadVersion,offset=state.offset+60;clearTimeout(previewTimer);state.loadingMore=true;publish()
  try{const page=await port.query(state.query,state.collection,offset);if(disposed||version!==loadVersion)return
   state.items=[...new Map([...state.items,...page.items].map(b=>[b.id,b])).values()];state.offset=offset;state.total=page.total;state.collections=page.collections;state.error='';schedulePreview()
  }catch(e){if(disposed||version!==loadVersion)return;state.error=error(e)}finally{if(!disposed&&version===loadVersion){state.loadingMore=false;publish()}}
 }
 async function action<T>(fn:()=>Promise<T>){if(state.busy||disposed)return;loadVersion++;clearTimeout(previewTimer);state.loading=false;state.loadingMore=false;state.busy=true;state.error='';publish();try{return await fn()}catch(e){state.error=error(e);return undefined}finally{state.busy=false;publish()}}
 return {
 getSnapshot:()=>state,
 refreshPreview(id:string){return action(async()=>{await port.refreshPreview?.(id);await load()})},
 filter(query:string,collection:string){state.query=query;state.collection=collection;state.offset=0;state.items=[];state.total=0;state.loaded=false;state.loading=false;state.loadingMore=false;state.error='';loadVersion++;clearTimeout(previewTimer);publish();clearTimeout(filterTimer);filterTimer=setTimeout(()=>{void load()},200)},
 loadMore,subscribe(f:()=>void){listeners.add(f);return()=>{listeners.delete(f)}},load,
 async save(input:BookmarkInput){return action(async()=>{const result=await port.save(input);if(result.status!=='saved'){state.error=result.status==='duplicate'?'这个链接已经收藏。':result.status==='conflict'?'收藏已被修改，请关闭后重新打开。':'收藏内容无效。';return false}state.items=[result.bookmark!,...state.items.filter(b=>b.id!==result.bookmark!.id)];await load();return true})},
 async remove(item:Bookmark){return action(async()=>{if(!await port.remove(item.id,item.revision)){state.error='收藏已被修改，请刷新后重试。';return false}state.items=state.items.filter(b=>b.id!==item.id);await load();return true})},
 preview(value:string){return action(async()=>{const preview=await port.preview(value);html=value;state.importPreview=preview;state.importResult=null})},
 importHtml(){return action(async()=>{if(!state.importPreview)throw Error('请先选择书签文件。');state.importResult=await port.importHtml(html);state.importPreview=null;html='';await load()})},
 clearImport(){if(state.busy)return;state.importPreview=null;state.importResult=null;html='';publish()},
 reportError(message:string){state.error=message;publish()},
 dispose(){disposed=true;clearTimeout(filterTimer);clearTimeout(previewTimer);loadVersion++;html='';listeners.clear()},
 }
}
