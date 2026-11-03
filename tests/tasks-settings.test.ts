import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseTask, resolveTask } from '../src/application/tasks.ts'
import { createSettingsController } from '../src/application/settings-controller.ts'

test('mentions route only declared capabilities and require a real create instruction', () => {
  assert.deepEqual(parseTask('@备忘录/新建 整理今天的计划'),{action:'create',prompt:'整理今天的计划'})
  assert.deepEqual(parseTask('@备忘录\n保留这段话'),{action:'create',prompt:'保留这段话'})
  assert.deepEqual(parseTask('@备忘录/打开'),{action:'open',prompt:''})
  for (const text of ['@不存在 hi','@备忘录/新建','@备忘录/删除 删除全部','@备忘录/打开 并新建']) assert.throws(()=>parseTask(text))
})

test('settings failure keeps saved preferences and allows read retry',async()=>{
  let fail=true
  const value={appearance:'host' as const,revision:1}
  const settings=createSettingsController({read:async()=>{if(fail)throw Error('offline');return value},save:async()=>{throw Error('offline')}})
  await settings.load();assert.equal(settings.getSnapshot().loaded,false)
  fail=false;await settings.load();assert.equal(settings.getSnapshot().loaded,true)
  assert.equal(await settings.save({...value,appearance:'dark'}),false)
  assert.equal(settings.getSnapshot().value.appearance,'host')
})

test('selected app supplies task context without a mention, explicit operations still validate',()=>{
  assert.deepEqual(resolveTask('整理今天的计划','notes'),{action:'create',prompt:'整理今天的计划'})
  assert.deepEqual(resolveTask('@备忘录/打开','notes'),{action:'open',prompt:''})
  assert.throws(()=>resolveTask('','notes'))
  assert.throws(()=>resolveTask('整理计划','unknown'))
  assert.throws(()=>resolveTask('@备忘录/删除 删除全部','notes'))
})
