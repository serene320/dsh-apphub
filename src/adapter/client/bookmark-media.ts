import {useEffect,useRef,useState} from 'react'
import type {Bookmark} from '../../contracts.ts'
export function useBookmarkMedia(items:Bookmark[]){
  const cache=useRef(new Map<string,string>()),[urls,setUrls]=useState<Record<string,string>>({})
  const keys=[...new Set(items.flatMap(b=>[b.preview?.image,b.preview?.icon]).filter((v):v is string=>Boolean(v)))].sort()
  const signature=keys.join(',')
  useEffect(()=>{
    const abort=new AbortController(),wanted=new Set(keys)
    for(const [key,url] of cache.current){if(!wanted.has(key)){URL.revokeObjectURL(url);cache.current.delete(key)}}
    setUrls(Object.fromEntries(cache.current))
    const pending=keys.filter(key=>!cache.current.has(key))
    const transport=(globalThis as typeof globalThis&{__DSH_TRANSPORT__?:{fetch:typeof fetch}}).__DSH_TRANSPORT__
    async function worker(){while(pending.length&&!abort.signal.aborted){const key=pending.shift()!;try{
      const response=await (transport?.fetch??fetch)('/api/apphub/bookmark-image?id='+encodeURIComponent(key),{signal:abort.signal})
      if(!response.ok)continue
      const blob=await response.blob();if(abort.signal.aborted)break
      cache.current.set(key,URL.createObjectURL(blob));setUrls(Object.fromEntries(cache.current))
    }catch{}}}
    void worker();void worker()
    return()=>abort.abort()
  },[signature])
  useEffect(()=>()=>{for(const url of cache.current.values())URL.revokeObjectURL(url);cache.current.clear()},[])
  return urls
}
