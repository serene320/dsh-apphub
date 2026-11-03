import type { HubSnapshot } from '../contracts.ts'
export type HomeState =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; snapshot: HubSnapshot }
  | { status: 'error'; message: string }
export interface HubPort { read(requestId: string, signal: AbortSignal): Promise<HubSnapshot> }

/** Owns request lifetimes and validation, independently of React or DSH. */
export function createHomeController(port: HubPort, timeoutMs = 5000) {
  let state: HomeState = { status: 'idle' }
  let active: AbortController | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let generation = 0
  let disposed = false
  const listeners = new Set<() => void>()
  const publish = (next: HomeState) => { state = next; for (const listener of listeners) listener() }
  function cancel() {
    generation++
    clearTimeout(timer)
    active?.abort()
    active = undefined
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    async refresh() {
      if (disposed || active) return
      const token = ++generation
      const controller = new AbortController()
      active = controller
      const requestId = crypto.randomUUID()
      publish({ status: 'loading' })
      const requestTimer = setTimeout(() => {
        if (token !== generation || disposed) return
        cancel()
        publish({ status: 'error', message: '应用加载超时，请重试。' })
      }, timeoutMs)
      timer = requestTimer
      try {
        const value = await port.read(requestId, controller.signal)
        if (token !== generation || disposed) return
        if (!value || value.requestId !== requestId || !Number.isFinite(Date.parse(value.checkedAt)) ||
            !Array.isArray(value.apps) || value.apps.some(app => !app || typeof app.id !== 'string' || typeof app.name !== 'string' || typeof app.description !== 'string')) {
          throw new Error('INVALID_RESPONSE')
        }
        publish({ status: 'ready', snapshot: value })
      } catch (error) {
        if (token !== generation || disposed) return
        const code = error instanceof Error ? error.message : ''
        publish({ status: 'error', message: code === 'INVALID_RESPONSE' ? '收到的应用信息无效，请重试。' : /denied|unauthorized|forbidden/i.test(code) ? '当前连接没有访问权限，请重新登录宿主。' : '暂时无法读取应用，请检查宿主连接后重试。' })
      } finally {
        clearTimeout(requestTimer)
        if (token === generation) active = undefined
      }
    },
    dispose() { disposed = true; cancel(); listeners.clear() },
  }
}
