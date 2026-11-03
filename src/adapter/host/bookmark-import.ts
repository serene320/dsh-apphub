import {parse} from 'parse5'
import type {DefaultTreeAdapterMap} from 'parse5'
import type {BookmarkImportPreview} from '../../contracts.ts'
import {bookmarkUrl} from '../../application/bookmarks.ts'
type Node=DefaultTreeAdapterMap['node']
const children=(node:Node):Node[]=>'childNodes' in node?node.childNodes:[]
const tag=(node:Node)=>'tagName' in node?node.tagName:''
function text(node:Node):string{return 'value' in node?node.value:children(node).map(text).join('')}
export function parseBookmarkHtml(html:string):BookmarkImportPreview {
  if(typeof html!=='string'||Buffer.byteLength(html)>10*1024*1024)throw Error('书签文件不能超过 10 MB。')
  if(!/NETSCAPE-Bookmark-file-1/i.test(html))throw Error('请选择 Chrome 导出的书签 HTML 文件。')
  const root=parse(html),result:BookmarkImportPreview={items:[],skipped:0};let count=0
  function walk(node:Node,path:string[],depth:number){
    if(depth>100)throw Error('书签目录嵌套过深。')
    let folder=''
    for(const child of children(node)){
      if(tag(child)==='h3'){folder=text(child).trim();continue}
      if(tag(child)==='a'){
        if(++count>10000)throw Error('每次最多导入 10000 条收藏。')
        const href='attrs' in child?child.attrs.find(a=>a.name==='href')?.value:undefined
        try{const collection=path.join(' / ');if(collection.length>300)throw Error('目录过长');result.items.push({url:bookmarkUrl(href??''),title:text(child).trim().slice(0,300),collections:collection?[collection]:[]})}catch{result.skipped++}
      }else if(tag(child)==='dl'){walk(child,folder?[...path,folder]:path,depth+1);folder=''}
      else {walk(child,path,depth+1);const h=children(child).find(c=>tag(c)==='h3');if(h)folder=text(h).trim()}
    }
  }
  walk(root,[],0)
  if(!result.items.length&&!result.skipped)throw Error('文件中没有找到书签。')
  return result
}
