import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHomeController } from '../src/application/home-controller.ts'
import { readHub } from '../src/application/hub.ts'
import type { HubSnapshot } from '../src/contracts.ts'

test('host validates correlation and reports the available notes app', () => {
  const id = crypto.randomUUID()
  assert.deepEqual(readHub(id, () => new Date('2026-11-03T00:00:00Z')), { requestId: id, checkedAt: '2026-11-03T00:00:00.000Z', apps: [{ id: 'notes', name: '备忘录', description: '随手记录，留住想法。' },{id:'bookmarks',name:'收藏夹',description:'收藏链接，整理值得留下的内容。'}] })
  assert.throws(() => readHub('bad'), /INVALID_REQUEST_ID/)
})
test('repeated clicks coalesce; an actual response is required for ready', async () => {
  let calls = 0, finish!: (v: HubSnapshot) => void, id = ''
  const controller = createHomeController({ read: requestId => { calls++; id = requestId; return new Promise(resolve => { finish = resolve }) } })
  const pending = controller.refresh()
  await controller.refresh()
  assert.equal(calls, 1)
  assert.equal(controller.getSnapshot().status, 'loading')
  finish(readHub(id)); await pending
  assert.equal(controller.getSnapshot().status, 'ready')
  controller.dispose()
})
test('timeout permits retry and ignores the previous late response', async () => {
  let finish!: (v: HubSnapshot) => void, oldId = '', calls = 0
  const controller = createHomeController({ read: async id => { if (++calls === 1) { oldId = id; return new Promise(resolve => { finish = resolve }) } return readHub(id) } }, 10)
  const old = controller.refresh()
  await new Promise(resolve => setTimeout(resolve, 25))
  assert.equal(controller.getSnapshot().status, 'error')
  await controller.refresh()
  const expected = controller.getSnapshot()
  finish(readHub(oldId)); await old
  assert.equal(controller.getSnapshot(), expected)
  controller.dispose()
})
test('unmount aborts request and prevents state publication', async () => {
  let finish!: (v: HubSnapshot) => void, signal!: AbortSignal, id = '', notifications = 0
  const controller = createHomeController({ read: (value, abort) => { id = value; signal = abort; return new Promise(resolve => { finish = resolve }) } })
  controller.subscribe(() => notifications++)
  const pending = controller.refresh()
  controller.dispose()
  assert.equal(signal.aborted, true)
  finish(readHub(id)); await pending
  assert.equal(notifications, 1)
})
test('mismatched response cannot report connection success', async () => {
  const controller = createHomeController({ read: async () => readHub(crypto.randomUUID()) })
  await controller.refresh()
  assert.equal(controller.getSnapshot().status, 'error')
  controller.dispose()
})
