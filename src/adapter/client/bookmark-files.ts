import {bookmarkUrl} from '../../application/bookmarks.ts'
/** Native file selection stays in the adapter; no browser profile access. */
export function chooseBookmarkFile(onRead:(html:string)=>void,onError:(message:string)=>void){
 const input=document.createElement('input');input.type='file';input.accept='.html,.htm';input.hidden=true
 const cleanup=()=>input.remove()
 input.addEventListener('cancel',cleanup,{once:true})
 input.addEventListener('change',()=>{const file=input.files?.[0];cleanup();if(!file)return;if(file.size>10*1024*1024){onError('书签文件不能超过 10 MB。');return}void file.text().then(onRead,()=>onError('文件读取失败。'))},{once:true})
 document.body.append(input);input.click()
}
/** Reuse the DSH desktop handler, validating the URL before opening. */
export function openBookmark(url:string){window.open(bookmarkUrl(url),'_blank','noopener,noreferrer')}
