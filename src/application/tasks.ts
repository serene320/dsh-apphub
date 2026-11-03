export const capabilities = [
  { mention: '@收藏夹', label:'收藏夹', description:'查找网站并收藏、整理分组', action:'create', appId:'bookmarks' },
  { mention: '@收藏夹/打开', label:'打开收藏夹', description:'浏览已有收藏', action:'open', appId:'bookmarks' },
  { mention: '@备忘录', label: '备忘录', description: '让 AI 整理想法并新建便签', action: 'create', appId:'notes' },
  { mention: '@备忘录/新建', label: '新建便签', description: '按你的要求生成并保存便签', action: 'create', appId:'notes' },
  { mention: '@备忘录/打开', label: '打开备忘录', description: '直接进入已有便签', action: 'open', appId:'notes' },
] as const
export function parseTask(text: string): { action: 'create' | 'open'; prompt: string; appId:string } {
  const value = text.trim()
  const match = capabilities.slice().sort((a,b) => b.mention.length-a.mention.length).find(c => value === c.mention || value.startsWith(c.mention+' ') || value.startsWith(c.mention+'\n'))
  if (!match) throw new Error('请用 @ 选择应用或功能。')
  const prompt = value.slice(match.mention.length).trim()
  if (match.action === 'create' && !prompt) throw new Error('写下希望应用完成的任务。')
  if (prompt.length > 12000) throw new Error('任务内容过长，请缩短到 12000 字以内。')
  if (match.action === 'open' && prompt) throw new Error('“打开”直接进入应用；需要 AI 处理内容请选择“新建”。')
  return { action: match.action, prompt, appId:match.appId }
}

/** Resolve a submitted task once; later navigation cannot change its target. */
export function resolveTask(text:string,appId:string) {
  if(text.trim().startsWith('@')) return parseTask(text)
  if(!['notes','bookmarks'].includes(appId)) throw new Error('请选择支持任务的应用。')
  return parseTask((appId==='bookmarks'?'@收藏夹 ':'@备忘录/新建 ')+text.trim())
}
