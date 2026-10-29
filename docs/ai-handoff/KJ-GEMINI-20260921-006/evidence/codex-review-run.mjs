import fs from 'node:fs/promises'

// Preserve executor evidence; run the submitted harness with extra error observation.
let source = await fs.readFile('docs/ai-handoff/KJ-GEMINI-20260921-006/run-costing-isolation-tests.mjs', 'utf8')
const directoryLine = "const EVIDENCE_DIR = path.join(TASK_DIR, 'evidence');"
const pageLine = 'const page = await context.newPage();'
if (!source.includes(directoryLine) || !source.includes(pageLine)) throw new Error('Harness shape changed')
source = source.replace(directoryLine, "const EVIDENCE_DIR = path.join(TASK_DIR, 'evidence', process.env.TEST_INJECT_CROSS_PROJECT_CORRUPTION === '1' ? 'codex-fault' : 'codex-normal');")
source = source.replace(pageLine, pageLine + `
const observedPageErrors = [];
page.on('pageerror', err => observedPageErrors.push({ name: err.name, message: err.message }));
`)
const finalMarker = '// 写入最终完整结果'
if (!source.includes(finalMarker)) throw new Error('Result marker missing')
source = source.replace(finalMarker, `
await fs.writeFile(path.join(EVIDENCE_DIR, 'observed-page-errors.json'), JSON.stringify(observedPageErrors, null, 2));
` + finalMarker)
await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))
