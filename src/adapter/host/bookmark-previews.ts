import {parse} from 'parse5'
import {createHash} from 'node:crypto'
import {lookup} from 'node:dns/promises'
import {request as httpsRequest} from 'node:https'
import {request as httpRequest} from 'node:http'
import ipaddr from 'ipaddr.js'
import type {BookmarkPreview} from '../../contracts.ts'
import type {createBookmarksService} from '../../application/bookmarks.ts'
import type {SqliteBookmarksRepository} from '../storage/bookmarks-sqlite.ts'

export interface WebAccess {
  fetch(input:{url:string},signal:AbortSignal):Promise<{url:string;statusCode:number;body:{kind:string;content:string}}>
}
export function publicImageAddress(address:string){try{const ip=ipaddr.parse(address);return ip.kind()==='ipv4'&&ip.range()==='unicast'}catch{return false}}
export function extractPreview(html:string,base:string){
  const result={title:'',description:'',image:'',icon:''},root=parse(html.slice(0,500000))
  const queue:typeof root.childNodes=[...root.childNodes]
  const url=(value:string)=>{try{const u=new URL(value,base);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:''}catch{return ''}}
  while(queue.length){const node=queue.pop()!;if('childNodes' in node)queue.push(...node.childNodes)
    if(!('tagName' in node))continue
    const attrs=Object.fromEntries(node.attrs.map(a=>[a.name,a.value])),key=attrs.property??attrs.name
    if(node.tagName==='meta'){
      if(key==='og:title')result.title=(attrs.content??'').slice(0,300)
      if(key==='og:description'||key==='description')result.description=(attrs.content??'').slice(0,1000)
      if(key==='og:image')result.image=url(attrs.content??'')
    }
    if(node.tagName==='link'&&/(^|\s)icon(\s|$)/i.test(attrs.rel??''))result.icon=url(attrs.href??'')
    if(node.tagName==='title'&&!result.title)result.title=node.childNodes.map(n=>'value'in n?n.value:'').join('').slice(0,300)
  }
  return result
}
/** Anonymous bounded image fetch. Pin a validated public IPv4 address at each redirect.
 * IPv6-only/translated networks fail closed. Never inherit browser cookies or proxy credentials. */
export async function fetchPublicImage(value:string,signal:AbortSignal,redirects=0):Promise<{mime:string;body:Buffer}>{
  const url=new URL(value)
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||value.length>4096)throw Error('图片地址不支持')
  signal.throwIfAborted()
  const addresses=await new Promise<{address:string;family:number}[]>((resolve,reject)=>{
    const cancel=()=>reject(signal.reason??Error('图片请求已取消'))
    signal.addEventListener('abort',cancel,{once:true})
    lookup(url.hostname,{all:true,family:4}).then(resolve,reject).finally(()=>signal.removeEventListener('abort',cancel))
  })
  signal.throwIfAborted()
  if(!addresses.length||addresses.some(a=>!publicImageAddress(a.address)))throw Error('图片地址未通过公网检查')
  return new Promise((resolve,reject)=>{
    const request=(url.protocol==='https:'?httpsRequest:httpRequest)(url,{method:'GET',agent:false,family:4,signal,lookup:(_host,_options,callback)=>callback(null,addresses[0]!.address,4),headers:{Accept:'image/png,image/jpeg,image/webp','User-Agent':'DSH-AppHub/0.1'}},response=>{
      if(response.statusCode&&response.statusCode>=300&&response.statusCode<400){response.resume();if(redirects>=3||!response.headers.location){reject(Error('图片重定向过多'));return}const next=new URL(response.headers.location,url);if(url.protocol==='https:'&&next.protocol!=='https:'){reject(Error('拒绝不安全重定向'));return}void fetchPublicImage(next.href,signal,redirects+1).then(resolve,reject);return}
      const mime=String(response.headers['content-type']??'').split(';')[0]!
      if(response.statusCode!==200||!['image/png','image/jpeg','image/webp'].includes(mime)){response.resume();reject(Error('图片格式不支持'));return}
      const chunks:Buffer[]=[];let bytes=0
      response.on('data',(chunk:Buffer)=>{bytes+=chunk.length;if(bytes>2*1024*1024){response.destroy(Error('图片超过 2 MB'));return}chunks.push(chunk)})
      response.on('error',reject);response.on('end',()=>{
        const body=Buffer.concat(chunks)
        const valid=mime==='image/png'?body.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):mime==='image/jpeg'?body[0]===255&&body[1]===216:body.toString('ascii',0,4)==='RIFF'&&body.toString('ascii',8,12)==='WEBP'
        if(!valid){reject(Error('图片内容不匹配'));return}resolve({mime,body})
      })
    });request.on('error',reject);request.setTimeout(10000,()=>request.destroy(Error('图片超时')));request.end()
  })
}
export function createBookmarkPreviews(service:ReturnType<typeof createBookmarksService>,media:SqliteBookmarksRepository,web:()=>WebAccess|undefined){
  const queue:string[]=[],pending=new Set<string>(),abort=new AbortController();let active=0,disposed=false
  async function process(id:string){const item=service.find(id);if(!item||item.deletedAt)return
    const signal=AbortSignal.any([abort.signal,AbortSignal.timeout(15000)])
    let value:BookmarkPreview={status:'failed',title:'',description:'',image:'',icon:'',error:'',checkedAt:new Date().toISOString()}
    try{
      const provider=web();if(!provider)throw Error('DSH 网页抓取不可用')
      const page=await provider.fetch({url:item.url},signal)
      if(page.statusCode<200||page.statusCode>=300||page.body.kind!=='html')throw Error('网页没有可用预览')
      const extracted=extractPreview(page.body.content,page.url)
      value={...value,title:extracted.title,description:extracted.description,status:'ready'}
      for(const kind of ['image','icon'] as const){if(!extracted[kind])continue;try{const image=await fetchPublicImage(extracted[kind],signal);const key=createHash('sha256').update(extracted[kind]).digest('hex');media.putMedia(key,image.mime,image.body);value[kind]=key}catch{}}
    }catch(error){value.error=error instanceof Error?error.message.slice(0,200):'预览不可用'}
    if(!disposed)service.preview(id,item.url,value)
  }
  function drain(){while(!disposed&&active<2&&queue.length){const id=queue.shift()!;active++;void process(id).catch(()=>{}).finally(()=>{active--;pending.delete(id);drain()})}}
  return {enqueue(ids:string[]){for(const id of ids.slice(0,60)){if(pending.has(id)||queue.length>=120)continue;const b=service.find(id);if(!b||b.deletedAt)continue;const p=b.preview;if(p&&(!p.image||media.media(p.image))&&(!p.icon||media.media(p.icon))&&Date.now()-Date.parse(p.checkedAt)<(p.status==='failed'?300000:86400000))continue;pending.add(id);queue.push(id)}drain()},dispose(){disposed=true;abort.abort();queue.length=0;pending.clear()}}
}
