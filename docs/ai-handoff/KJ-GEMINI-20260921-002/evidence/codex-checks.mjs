import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../../..')
const manifest = path.join(root, 'ozon-react/public/data/manifest.json')
const before = fs.readFileSync(manifest)
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex')
const checks = []
const commands = [
  ['layout', 'node tests/ia-project-compliance-layout.test.mjs'],
  ['draft', 'node tests/ia-project-compliance-draft.test.mjs'],
  ['compliance', 'node tests/ia-project-compliance.test.mjs'],
  ['gate', 'node tests/ia-project-compliance-gate.test.mjs'],
  ['npm', 'npm.cmd test'],
  ['golden', 'npm.cmd run test:golden'],
  ['sync', 'npm.cmd run test:sync'],
  ['build', 'npm.cmd --prefix ozon-react run build'],
]
function run(name, command, env = {}) {
  const result = spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', command], {
    cwd: root, encoding: 'utf8', timeout: 240000, maxBuffer: 20 * 1024 * 1024,
    env: { ...process.env, LAYOUT_EVIDENCE_DIR: path.join(here, 'codex-layout'), ...env },
  })
  const output = (result.stdout || '') + '\n' + (result.stderr || '')
  fs.writeFileSync(path.join(here, `codex-${name}.log`), output)
  return { result, output }
}
try {
  for (const [name, command] of commands) {
    const { result, output } = run(name, command)
    const browserRan = name === 'draft' ? output.includes('ALL SCENARIOS (A, B, C, F, G, G2, G3 & EXTENDED BROWSER TESTS) PASSED')
      : name === 'layout' ? output.includes('ALL LAYOUT & VISUAL MEASUREMENT TESTS PASSED') : true
    const passed = result.status === 0 && browserRan
    checks.push({ name, command, exit_code: result.status, passed, error: result.error?.message || null })
    console.log(name, result.status, passed)
    if (!passed) break
  }
  const faultDir = path.join(here, 'codex-layout-fault')
  const { result, output } = run('layout-fault', commands[0][1], { LAYOUT_TEST_INJECT_FAILURE: '1', LAYOUT_EVIDENCE_DIR: faultDir })
  const report = JSON.parse(fs.readFileSync(path.join(faultDir, 'layout-test-results.json'), 'utf8'))
  checks.push({ name: 'layout-fault', exit_code: result.status, passed: result.status !== 0 && report.passed === false && output.includes('LAYOUT FAULT INJECTION') && !output.includes('ALL LAYOUT & VISUAL MEASUREMENT TESTS PASSED') })
  console.log('layout-fault', checks.at(-1))
} finally {
  fs.writeFileSync(manifest, before)
  fs.writeFileSync(path.join(here, 'codex-checks.json'), JSON.stringify({ checks, manifest_before: sha(before), manifest_after: sha(fs.readFileSync(manifest)) }, null, 2) + '\n')
}
process.exitCode = checks.length === 9 && checks.every(c => c.passed) ? 0 : 1
