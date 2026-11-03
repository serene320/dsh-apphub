import type { HubSettings, SettingsResult } from '../contracts.ts'
export const defaultSettings: HubSettings = { appearance: 'host', revision: 0 }
export function createSettingsController(port: { read(): Promise<HubSettings>; save(value: HubSettings): Promise<SettingsResult> }) {
  let state = { value: defaultSettings, busy: false, loaded: false, error: '' }
  const listeners = new Set<() => void>()
  const publish = (patch: Partial<typeof state>) => { state = {...state,...patch}; listeners.forEach(f => f()) }
  return {
    getSnapshot: () => state,
    subscribe(f: () => void) { listeners.add(f); return () => { listeners.delete(f) } },
    async load() { if (state.busy) return; publish({busy:true,error:''}); try { publish({value: await port.read(), loaded:true}) } catch { publish({error:'设置读取失败，请重试。'}) } finally {publish({busy:false})} },
    async save(value: HubSettings) {
      if (state.busy || !state.loaded) return false
      publish({busy:true,error:''})
      try { const result = await port.save(value); publish({value:result.settings}); if(result.status !== 'saved') {publish({error:result.status === 'conflict' ? '设置已更新，请重新选择。' : '设置内容无效。'}); return false} return true }
      catch {publish({error:'设置保存失败，原设置保持不变。'}); return false}
      finally {publish({busy:false})}
    },
  }
}
