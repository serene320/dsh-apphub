/** Observe release without requiring card focus; reconcile dropped keyup from real pointer flags. */
export function watchBookmarkModifiers(onRelease:()=>void,onCancel:()=>void,target:EventTarget=window,visibility:EventTarget&{hidden?:boolean}=document){
 const capture={capture:true};let held=false
 const cancel=()=>{held=false;onCancel()}
 const release=(event:Event)=>{const e=event as KeyboardEvent;if((e.key==='Meta'||e.key==='Control'||e.key==='OS')&&!e.metaKey&&!e.ctrlKey){held=false;onRelease()}}
 const keyDown=(event:Event)=>{const e=event as KeyboardEvent;if(e.key==='Escape')cancel();else if(e.metaKey||e.ctrlKey||e.key==='Meta'||e.key==='Control')held=true}
 const observe=(event:Event)=>{const e=event as MouseEvent;if(e.metaKey||e.ctrlKey)held=true}
 const reconcile=(event:Event)=>{const e=event as PointerEvent;if(e.metaKey||e.ctrlKey){held=true;return}if(held){held=false;onRelease()}}
 const hidden=()=>{if(visibility.hidden)cancel()}
 target.addEventListener('keyup',release,capture);target.addEventListener('keydown',keyDown,capture);target.addEventListener('blur',cancel)
 target.addEventListener('pointerdown',observe,capture);target.addEventListener('click',observe,capture);target.addEventListener('pointermove',reconcile,capture)
 visibility.addEventListener('visibilitychange',hidden)
 return()=>{target.removeEventListener('keyup',release,capture);target.removeEventListener('keydown',keyDown,capture);target.removeEventListener('blur',cancel);target.removeEventListener('pointerdown',observe,capture);target.removeEventListener('click',observe,capture);target.removeEventListener('pointermove',reconcile,capture);visibility.removeEventListener('visibilitychange',hidden)}
}
