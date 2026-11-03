/** Native file selection stays in the adapter; no browser profile access. */
export function chooseBookmarkFile(onRead:(html:string)=>void,onError:(message:string)=>void){
 const input=document.createElement('input');input.type='file';input.accept='.html,.htm';input.hidden=true
 const cleanup=()=>input.remove()
 input.addEventListener('cancel',cleanup,{once:true})
 input.addEventListener('change',()=>{const file=input.files?.[0];cleanup();if(!file)return;if(file.size>10*1024*1024){onError('书签文件不能超过 10 MB。');return}void file.text().then(onRead,()=>onError('文件读取失败。'))},{once:true})
 document.body.append(input);input.click()
}
export function openBookmark(url:string){const target=new URL(url);if(!['http:','https:'].includes(target.protocol)||target.username||target.password)throw Error('链接无效。');window.open(target.href,'_blank','noopener,noreferrer')}
