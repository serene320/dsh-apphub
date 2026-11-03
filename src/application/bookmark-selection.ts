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
