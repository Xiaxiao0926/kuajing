// Local-only review harness: real React component, in-memory Store, no server writes.
import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../../..')
const app = path.join(root, 'ozon-react')
const requireApp = createRequire(path.join(app, 'package.json'))
const { build } = requireApp('esbuild')
if (!process.env.CODEX_NODE_MODULES) throw new Error('Set CODEX_NODE_MODULES to the bundled Node packages directory.')
const runtimeRequire = createRequire(path.join(process.env.CODEX_NODE_MODULES, '_review.cjs'))
const { chromium } = runtimeRequire('playwright')
const postcss = requireApp('postcss')
const tailwind = requireApp('tailwindcss')
const autoprefixer = requireApp('autoprefixer')
const twConfig = (await import(pathToFileURL(path.join(app,'tailwind.config.js')).href)).default
const css = (await postcss([tailwind({...twConfig,content:[path.join(app,'src/**/*.{js,jsx}').replaceAll('\\','/')]}),autoprefixer]).process(await fs.readFile(path.join(app,'src/index.css'),'utf8'),{from:path.join(app,'src/index.css')})).css
const bundle = await build({
  stdin: {
    resolveDir: app, loader: 'jsx', sourcefile: 'codex-review.jsx', contents: `
import React from 'react';
import { createRoot } from 'react-dom/client';
import Panel from './src/components/t6/ProjectCompliancePanel.jsx';
import * as store from './src/utils/t6/t6Store.js';
const memory = new Map();
store._setAdapterForTests({get:k=>memory.has(k)?JSON.parse(memory.get(k)):null,set:(k,v)=>memory.set(k,JSON.stringify(v)),keys:()=>[...memory.keys()]});
const {candidate}=store.ensureCandidate({sourceProductId:'review-only',name:'Synthetic review',categoryLeaf:'test'});
const snap=store.createSnapshot({candidateId:candidate.id,sourceProductId:candidate.sourceProductId,sourceInputs:{name:'test'},scoreResult:{totalScore:80,grade:'B',status:'RECOMMENDED'},marketContext:{matchMethod:'exact'},marketEvidence:{}});
const a=store.createProject({candidateId:candidate.id,creationSnapshotId:snap.id,name:'Synthetic A'});
const b=store.createProject({candidateId:candidate.id,creationSnapshotId:snap.id,name:'Synthetic B'});
store.updateProjectCompliance(b.id,{notes:'B ORIGINAL',certificationPlan:'B PLAN'});
const view=createRoot(document.getElementById('root'));
window.review={a:a.id,b:b.id,render:(id)=>view.render(<Panel projectId={id}/>),read:(id)=>store.getProject(id),update:(id,patch)=>store.updateProjectCompliance(id,patch)};
window.review.render(a.id);
`
  }, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"development"' }
})
const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const results = { scope: 'Isolated real React with project CSS; component layout only, not WordPress shell; no production writes', cases: [] }
async function fresh() {
  const page = await browser.newPage()
  await page.route('**/*', route => route.abort())
  await page.setContent('<html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0"><main class="fyzsxnb-kuajing-root" style="padding:12px"><div id="root"></div></main></body></html>')
  await page.addStyleTag({content:css})
  await page.addScriptTag({ content: bundle.outputFiles[0].text })
  await page.getByRole('button', {name:'保存评估状态',exact:true}).waitFor()
  return page
}
try {
  const page = await fresh()
  const notes = page.locator('textarea').nth(0)
  const plan = page.locator('textarea').nth(2)
  await plan.fill('A UNSAVED PLAN')
  await notes.fill('A SAVED NOTES')
  await page.getByRole('button',{name:'保存评估状态',exact:true}).click()
  results.cases.push({name:'A: saving assessment preserves plan',passed:(await plan.inputValue())==='A UNSAVED PLAN'})
  await notes.fill('A UNSAVED NOTES')
  await page.getByRole('button',{name:'保存合规计划',exact:true}).click()
  results.cases.push({name:'B: saving plan preserves assessment',passed:(await notes.inputValue())==='A UNSAVED NOTES'})
  await page.evaluate(()=>window.review.render(window.review.b))
  await page.waitForFunction(()=>document.querySelector('[data-testid="assessment-conflict-banner"]') || document.querySelector('textarea')?.value==='B ORIGINAL')
  const notesAfterSwitch=await notes.inputValue()
  await page.getByRole('button',{name:'保存评估状态',exact:true}).click()
  const savedB=await page.evaluate(()=>window.review.read(window.review.b).compliance.notes)
  results.cases.push({name:'F: same component switching A to B',passed:notesAfterSwitch==='B ORIGINAL' && savedB==='B ORIGINAL',notesAfterSwitch,savedB,expected:'B ORIGINAL'})
  await page.close()
  const external=await fresh()
  await external.locator('textarea').nth(0).fill('LOCAL DRAFT')
  await external.evaluate(()=>{window.review.update(window.review.a,{notes:'EXTERNAL UPDATE',certificationPlan:'EXTERNAL PLAN'});window.review.render(window.review.a)})
  // Wait for the forced parent render without touching component-local tick.
  await external.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
  const externalPlan=await external.locator('textarea').nth(2).inputValue()
  const conflictCount=await external.locator('[data-testid="assessment-conflict-banner"]').count()
  results.cases.push({name:'G: external Store change plus parent rerender',passed:externalPlan==='EXTERNAL PLAN' && conflictCount===1,externalPlan,conflictCount})
  // Reverting to the old baseline must not silently hide a newer external value.
  await external.locator('textarea').nth(0).fill('')
  await external.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
  const revertedValue=await external.locator('textarea').nth(0).inputValue()
  const revertedConflict=await external.locator('[data-testid="assessment-conflict-banner"]').count()
  await external.getByRole('button',{name:'保存评估状态',exact:true}).click()
  const storedAfterRevert=await external.evaluate(()=>window.review.read(window.review.a).compliance.notes)
  results.cases.push({name:'G2: reverting draft to old baseline preserves external update or explicit conflict',passed:revertedValue==='EXTERNAL UPDATE'||revertedConflict===1,revertedValue,revertedConflict,storedAfterRevert})
  await external.close()
  const again=await fresh()
  await again.locator('textarea').nth(0).fill('LOCAL')
  await again.evaluate(()=>{window.review.update(window.review.a,{notes:'REMOTE'});window.review.render(window.review.a)})
  await again.locator('[data-testid="assessment-conflict-banner"]').waitFor()
  await again.locator('textarea').nth(0).fill('REMOTE')
  await again.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
  const dirtyAfterMatching=await again.locator('[data-testid="assessment-unsaved-badge"]').count()
  await again.locator('textarea').nth(0).fill('LOCAL AGAIN')
  await again.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
  const conflictAfterEditingAgain=await again.locator('[data-testid="assessment-conflict-banner"]').count()
  results.cases.push({name:'G3: after matching incoming then editing again, baseline must be rebased or conflict reappear',passed:dirtyAfterMatching===0||conflictAfterEditingAgain===1,conflictAfterEditingAgain,dirtyAfterMatching,notes:'Accept either adopting matching incoming as baseline or keeping an explicit conflict when edits diverge again.'})
  await again.close()
  for (const width of [1440,390]) {
    const visual=await fresh()
    await visual.setViewportSize({width,height:1000})
    await visual.locator('textarea').nth(0).fill('待核对的未保存说明，保留输入。')
    await visual.locator('textarea').nth(2).fill('待确认的方案，保留输入。')
    await visual.evaluate(()=>{window.review.update(window.review.a,{notes:'外部备注已更新',certificationPlan:'外部方案已更新'});window.review.render(window.review.a)})
    await visual.locator('[data-testid="assessment-conflict-banner"]').waitFor()
    const dimensions=await visual.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,controls:[...document.querySelectorAll('button,textarea,select')].map(e=>{const r=e.getBoundingClientRect();return {text:e.textContent?.trim().slice(0,25),left:r.left,right:r.right,width:r.width}})}))
    await visual.screenshot({path:path.join(here,`codex-final-${width}.png`),fullPage:true})
    results.cases.push({name:`H: component with actual project CSS at ${width}px`,passed:dimensions.scrollWidth<=dimensions.clientWidth && dimensions.controls.every(c=>c.left>=0&&c.right<=width+1),dimensions})
    await visual.close()
  }
} finally {
  await browser.close()
  await fs.writeFile(path.join(here,'codex-final-review.json'),JSON.stringify(results,null,2)+'\n')
}
console.log(JSON.stringify(results,null,2))
process.exitCode=results.cases.every(x=>x.passed)?0:1
