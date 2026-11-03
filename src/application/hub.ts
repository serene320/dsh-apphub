import type { HubSnapshot } from '../contracts.ts'

/** The source of available apps. UI layout does not determine registration. */
export function readHub(requestId: string, now: () => Date = () => new Date()): HubSnapshot {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
    throw new Error('INVALID_REQUEST_ID')
  }
  return { requestId, checkedAt: now().toISOString(), apps: [{ id: 'notes', name: '备忘录', description: '随手记录，留住想法。' }] }
}
