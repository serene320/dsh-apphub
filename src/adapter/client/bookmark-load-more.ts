import {useEffect,useRef} from 'react'

export function useBookmarkLoadMore(enabled:boolean,count:number,onLoad:()=>Promise<void>,filterKey:string){
 const sentinel=useRef<HTMLDivElement>(null),viewport=useRef<HTMLDivElement>(null)
 useEffect(()=>{viewport.current?.scrollTo({top:0})},[filterKey])
 useEffect(()=>{
  if(!enabled||!sentinel.current)return
  const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting))void onLoad()},{root:viewport.current,rootMargin:'0px 0px 120px 0px'})
  observer.observe(sentinel.current)
  return()=>observer.disconnect()
 },[enabled,count,onLoad])
 return {sentinel,viewport}
}
