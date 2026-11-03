import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
const script=fileURLToPath(new URL('../scripts/check-boundaries.mjs',import.meta.url))
function check(files:Record<string,string>){const dir=mkdtempSync(join(tmpdir(),'apphub-boundary-'));try{for(const [name,source] of Object.entries(files)){const path=join(dir,'src',name);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,source)}return spawnSync(process.execPath,[script],{cwd:dir,encoding:'utf8'})}finally{rmSync(dir,{recursive:true})}}
test('boundary guard permits official primitives and scoped theme adapter',()=>{
  const result=check({'ui/Page.tsx':"import {Button} from '@deepseek-ai/dsh-client-ui-primitives'; export const Page=()=> <Button>打开</Button>",'ui/appearance.css':'.apphub-shell[data-appearance=light]{--dsw-alias-bg-base:white}'})
  assert.equal(result.status,0,result.stderr)
})
test('boundary guard rejects host imports, direct I/O and native dialog in UI',()=>{
  const result=check({'ui/Page.tsx':"import remote from '../adapter/host/index.ts'; fetch('/notes'); export const Page=()=> <dialog/>"})
  assert.equal(result.status,1);assert.match(result.stderr,/Forbidden adapter/);assert.match(result.stderr,/Direct I\/O/);assert.match(result.stderr,/official control/)
})
test('boundary guard rejects application UI dependency and scattered/global themes',()=>{
  const result=check({'application/service.ts':"import React from 'react'",'ui/page.css':':root{color:red}.apphub-page{--dsw-alias-bg-base:white}'})
  assert.equal(result.status,1);assert.match(result.stderr,/Business\/contracts/);assert.match(result.stderr,/appearance.css/);assert.match(result.stderr,/global host/)
})
