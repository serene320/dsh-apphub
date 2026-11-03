import type {Bookmark} from '../contracts.ts'
export type BookmarkExportFormat='markdown'|'html'|'json'
export function formatBookmarks(items:readonly Bookmark[],format:BookmarkExportFormat){
 const clean=items.filter(b=>!b.deletedAt).map(({preview,...b})=>b)
 const html=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
 const md=(s:string)=>s.replace(/[\\`*_{}\[\]<>#]/g,'\\$&')
 if(format==='json')return {name:'bookmarks.json',mime:'application/json',text:JSON.stringify({version:1,bookmarks:clean},null,2)}
 if(format==='markdown')return {name:'bookmarks.md',mime:'text/markdown',text:'# 收藏夹\n\n'+clean.map(b=>`## ${md(b.title)}\n\n${b.url}\n\n${md(b.description||b.aiSummary||'')}\n\n集合：${b.collections.map(md).join(' / ')}\n标签：${b.tags.map(md).join('、')}\n${(b.sources??[]).map(u=>'来源：'+u).join('\n')}`).join('\n\n')}
 if(format!=='html')throw Error('不支持的导出格式')
 type Folder={links:typeof clean;children:Map<string,Folder>}
 const root:Folder={links:[],children:new Map()}
 for(const b of clean){for(const path of b.collections.length?b.collections:['']){let node=root;for(const part of path.split('/').filter(Boolean)){if(!node.children.has(part))node.children.set(part,{links:[],children:new Map()});node=node.children.get(part)!}node.links.push(b)}}
 const render=(f:Folder):string=>'<DL><p>\n'+f.links.map(b=>`<DT><A HREF="${html(b.url)}">${html(b.title)}</A>`).join('\n')+'\n'+[...f.children].map(([n,v])=>`<DT><H3>${html(n)}</H3>\n${render(v)}`).join('\n')+'\n</DL><p>'
 return {name:'bookmarks.html',mime:'text/html',text:'<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n<TITLE>Bookmarks</TITLE>\n<H1>Bookmarks</H1>\n'+render(root)}
}

export function collectBookmarkExport(page:(offset:number)=>{items:Bookmark[];total:number}){
 const items:Bookmark[]=[]
 for(let offset=0;;offset+=60){const result=page(offset);if(result.total>10000)throw Error('结果超过 10000 条，请缩小筛选范围。');items.push(...result.items);if(offset+60>=result.total)return items}
}
