/** Selection is limited to the visible result page; navigation cannot open hidden items. */
export function toggleBookmarkSelection(selected:readonly string[],id:string):string[]{
  return selected.includes(id)?selected.filter(value=>value!==id):[...selected,id]
}
export function selectedBookmarkUrls(items:readonly {id:string;url:string}[],selected:readonly string[]):string[]{
  const ids=new Set(selected)
  return [...new Set(items.filter(item=>ids.has(item.id)).map(item=>item.url))]
}
