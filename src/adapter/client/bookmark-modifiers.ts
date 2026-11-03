/** Observe release even when a macOS mouse click does not focus the card button. */
export function watchBookmarkModifiers(onRelease:()=>void,onCancel:()=>void,target:EventTarget=window,visibility:EventTarget&{hidden?:boolean}=document){
 const capture={capture:true}
 const release=(event:Event)=>{const key=(event as KeyboardEvent).key;if(key==='Meta'||key==='Control'||key==='OS')onRelease()}
 const cancelKey=(event:Event)=>{if((event as KeyboardEvent).key==='Escape')onCancel()}
 const hidden=()=>{if(visibility.hidden)onCancel()}
 target.addEventListener('keyup',release,capture);target.addEventListener('keydown',cancelKey,capture);target.addEventListener('blur',onCancel)
 visibility.addEventListener('visibilitychange',hidden)
 return()=>{target.removeEventListener('keyup',release,capture);target.removeEventListener('keydown',cancelKey,capture);target.removeEventListener('blur',onCancel);visibility.removeEventListener('visibilitychange',hidden)}
}
