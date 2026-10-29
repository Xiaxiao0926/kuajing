import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
const here=path.dirname(fileURLToPath(import.meta.url))
const root=path.resolve(here,'../../../..')
const manifest=path.join(root,'ozon-react/public/data/manifest.json')
const before=fs.readFileSync(manifest)
const checks=[]
const commands=[
 ['draft','node tests/ia-project-compliance-draft.test.mjs'],
 ['compliance','node tests/ia-project-compliance.test.mjs'],
 ['gate','node tests/ia-project-compliance-gate.test.mjs'],
 ['npm','npm.cmd test'],
 ['golden','npm.cmd run test:golden'],
 ['sync','npm.cmd run test:sync'],
 ['build','npm.cmd --prefix ozon-react run build'],
]
try {
 for(const [name,cmd] of commands){
  const result=spawnSync(process.env.ComSpec||'cmd.exe',['/d','/s','/c',cmd],{cwd:root,encoding:'utf8',timeout:240000,maxBuffer:20*1024*1024})
  fs.writeFileSync(path.join(here,`codex-final-${name}.log`),(result.stdout||'')+'\n'+(result.stderr||''))
  checks.push({name,command:cmd,exit_code:result.status,error:result.error?.message||null})
  console.log(name,result.status)
  if(result.status!==0) break
 }
 const testPath=path.join(root,'tests/ia-project-compliance-draft.test.mjs')
 const missingEnv={...process.env}; delete missingEnv.CODEX_NODE_MODULES
 for(const [name,env,expected] of [['missing-dependency',missingEnv,0],['fault-injection',{...process.env,TEST_INJECT_FAILURE:'1'},1]]){
  const result=spawnSync(process.execPath,[testPath],{cwd:root,env,encoding:'utf8',timeout:60000,maxBuffer:10*1024*1024})
  const output=(result.stdout||'')+'\n'+(result.stderr||'')
  fs.writeFileSync(path.join(here,`codex-final-${name}.log`),output)
  checks.push({name,exit_code:result.status,passed:result.status===expected&&!output.includes('ALL SCENARIOS')&&(name==='fault-injection'?output.includes('FAULT INJECTION'):output.includes('not_run'))})
  console.log(name,result.status)
 }
} finally {
 // Restore the exact pre-run bytes, not the Git version.
 fs.writeFileSync(manifest,before)
 const sha=b=>crypto.createHash('sha256').update(b).digest('hex')
 fs.writeFileSync(path.join(here,'codex-final-checks.json'),JSON.stringify({checks,manifest_before:sha(before),manifest_after:sha(fs.readFileSync(manifest))},null,2)+'\n')
}
process.exitCode=checks.every(c=>c.passed??c.exit_code===0)?0:1
