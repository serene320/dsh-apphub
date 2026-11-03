import {useEffect,useRef} from 'react'

export function useBookmarkLoadMore(enabled:boolean,count:number,onLoad:()=>Promise<void>){
 const sentinel=useRef<HTMLDivElement>(null)
 useEffect(()=>{
  if(!enabled||!sentinel.current)return
  const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting))void onLoad()},{rootMargin:'0px 0px 120px 0px'})
  observer.observe(sentinel.current)
  return()=>observer.disconnect()
 },[enabled,count,onLoad])
 return sentinel
}
