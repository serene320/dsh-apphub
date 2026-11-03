/** Selection is limited to the visible result page; navigation cannot open hidden items. */
export function toggleBookmarkSelection(selected:readonly string[],id:string):string[]{
  return selected.includes(id)?selected.filter(value=>value!==id):[...selected,id]
}
export function selectedBookmarkUrls(items:readonly {id:string;url:string}[],selected:readonly string[]):string[]{
  const ids=new Set(selected)
  return [...new Set(items.filter(item=>ids.has(item.id)).map(item=>item.url))]
}

export function bookmarkModifierRelease(selecting:boolean,modifierSelection:boolean,selectedCount:number):'open'|'clear'|'none'{
  if(!selecting)return 'none'
  if(selectedCount===0)return 'clear'
  return modifierSelection?'open':'none'
}

/** Event handlers read synchronous state; rendering must not gate release or cancellation. */
export function createBookmarkSelection(){
 let state={selected:[] as string[],selecting:false,modifier:false}
 const clear=()=>{if(state.selecting||state.selected.length||state.modifier)state={selected:[],selecting:false,modifier:false}}
 return {
  snapshot:()=>state,clear,
  begin(){state={...state,selecting:true}},
  toggle(id:string,modifier=false){state={selected:toggleBookmarkSelection(state.selected,id),selecting:true,modifier:state.modifier||modifier}},
  retain(ids:readonly string[]){const selected=state.selected.filter(id=>ids.includes(id));if(selected.length!==state.selected.length)state={...state,selected}},
  take(){const selected=state.selected;clear();return selected},
  release(){const action=bookmarkModifierRelease(state.selecting,state.modifier,state.selected.length);if(action==='none')return null;const selected=action==='open'?state.selected:[];clear();return selected},
 }
}
