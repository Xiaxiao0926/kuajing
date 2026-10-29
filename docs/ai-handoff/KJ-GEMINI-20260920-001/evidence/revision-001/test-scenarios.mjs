import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../../../..')
const app = path.join(root, 'ozon-react')
const requireApp = createRequire(path.join(app, 'package.json'))
const { build } = requireApp('esbuild')

const codexModulesPath = process.env.CODEX_NODE_MODULES || 'C:\\Users\\Administrator\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules'
const runtimeRequire = createRequire(path.join(codexModulesPath, '_review.cjs'))
const { chromium } = runtimeRequire('playwright')

const bundle = await build({
  stdin: {
    resolveDir: app,
    loader: 'jsx',
    sourcefile: 'test-harness.jsx',
    contents: `
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import Panel from './src/components/t6/ProjectCompliancePanel.jsx';
import * as store from './src/utils/t6/t6Store.js';

const memory = new Map();
store._setAdapterForTests({
  get: k => memory.has(k) ? JSON.parse(memory.get(k)) : null,
  set: (k, v) => memory.set(k, JSON.stringify(v)),
  keys: () => [...memory.keys()]
});

const { candidate } = store.ensureCandidate({ sourceProductId: 'rev1-test', name: 'Synthetic review', categoryLeaf: 'test' });
const snap = store.createSnapshot({
  candidateId: candidate.id,
  sourceProductId: candidate.sourceProductId,
  sourceInputs: { name: 'test' },
  scoreResult: { totalScore: 80, grade: 'B', status: 'RECOMMENDED' },
  marketContext: { matchMethod: 'exact' },
  marketEvidence: {}
});

const a = store.createProject({ candidateId: candidate.id, creationSnapshotId: snap.id, name: 'Synthetic A' });
const b = store.createProject({ candidateId: candidate.id, creationSnapshotId: snap.id, name: 'Synthetic B' });

store.updateProjectCompliance(a.id, {
  notes: 'A ORIGINAL NOTES',
  certificationPlan: 'A ORIGINAL PLAN',
  applicableStandards: ['TR CU 004/2011']
});
store.updateProjectCompliance(b.id, {
  notes: 'B ORIGINAL NOTES',
  certificationPlan: 'B ORIGINAL PLAN',
  applicableStandards: ['TR CU 020/2011']
});

const view = createRoot(document.getElementById('root'));

window.harness = {
  aId: a.id,
  bId: b.id,
  render: (id) => view.render(<Panel projectId={id} />),
  read: (id) => store.getProject(id),
  update: (id, patch) => store.updateProjectCompliance(id, patch),
  store
};

window.harness.render(a.id);
`
  },
  bundle: true,
  write: false,
  format: 'iife',
  platform: 'browser',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"development"' }
})

const browser = await chromium.launch({ headless: true, channel: 'chrome' })

async function fresh() {
  const page = await browser.newPage()
  await page.route('**/*', route => route.abort())
  await page.setContent('<html><body><div id="root"></div></body></html>')
  await page.addScriptTag({ content: bundle.outputFiles[0].text })
  await page.getByRole('button', { name: '保存评估状态', exact: true }).waitFor()
  return page
}

try {
  console.log('Testing Real Component Harness for Revision 001...')
  const page = await fresh()

  // Scenario A: Save assessment preserves plan draft
  const notesTextarea = page.locator('textarea').nth(0)
  const planTextarea = page.locator('textarea').nth(2)

  await planTextarea.fill('A DRAFT PLAN')
  await notesTextarea.fill('A SAVED NOTES')
  await page.getByRole('button', { name: '保存评估状态', exact: true }).click()
  assert.equal(await planTextarea.inputValue(), 'A DRAFT PLAN', 'Scenario A: plan draft preserved')
  console.log('  ✅ Scenario A passed')

  // Scenario B: Save plan preserves assessment draft
  await notesTextarea.fill('A DRAFT NOTES 2')
  await page.getByRole('button', { name: '保存合规计划', exact: true }).click()
  assert.equal(await notesTextarea.inputValue(), 'A DRAFT NOTES 2', 'Scenario B: assessment draft preserved')
  console.log('  ✅ Scenario B passed')

  // Scenario C: Requirement CRUD does not blow away drafts
  await notesTextarea.fill('UNSAVED NOTES FOR REQ TEST')
  await planTextarea.fill('UNSAVED PLAN FOR REQ TEST')
  await page.getByRole('button', { name: '新增事项', exact: true }).click()
  await page.locator('input[placeholder*="低电压安全核验"]').fill('测试事项 1')
  await page.getByRole('button', { name: '确认添加', exact: true }).click()
  assert.equal(await notesTextarea.inputValue(), 'UNSAVED NOTES FOR REQ TEST', 'Scenario C: notes preserved after req add')
  assert.equal(await planTextarea.inputValue(), 'UNSAVED PLAN FOR REQ TEST', 'Scenario C: plan preserved after req add')
  console.log('  ✅ Scenario C passed')

  // Scenario F: A -> B -> A and rapid switch
  // A currently has dirty drafts: 'UNSAVED NOTES FOR REQ TEST'
  await page.evaluate(() => window.harness.render(window.harness.bId))
  await page.waitForFunction(() => document.querySelector('textarea')?.value === 'B ORIGINAL NOTES')
  assert.equal(await notesTextarea.inputValue(), 'B ORIGINAL NOTES', 'Scenario F: B has its own notes')
  assert.equal(await planTextarea.inputValue(), 'B ORIGINAL PLAN', 'Scenario F: B has its own plan')

  // Save B and verify no cross-talk
  await page.getByRole('button', { name: '保存评估状态', exact: true }).click()
  const bData = await page.evaluate(() => window.harness.read(window.harness.bId))
  const aData = await page.evaluate(() => window.harness.read(window.harness.aId))
  assert.equal(bData.compliance.notes, 'B ORIGINAL NOTES')
  assert.equal(aData.compliance.notes, 'A SAVED NOTES')
  console.log('  ✅ Scenario F (A -> B) passed')

  // Switch back B -> A
  await page.evaluate(() => window.harness.render(window.harness.aId))
  await page.waitForFunction(() => document.querySelector('textarea')?.value === 'A SAVED NOTES')
  assert.equal(await notesTextarea.inputValue(), 'A SAVED NOTES', 'Scenario F (B -> A): A displays A stored value')
  console.log('  ✅ Scenario F (B -> A) passed')

  // Rapid switch A -> B -> A -> B
  await page.evaluate(() => {
    window.harness.render(window.harness.bId)
    window.harness.render(window.harness.aId)
    window.harness.render(window.harness.bId)
  })
  await page.waitForFunction(() => document.querySelector('textarea')?.value === 'B ORIGINAL NOTES')
  assert.equal(await notesTextarea.inputValue(), 'B ORIGINAL NOTES', 'Scenario F rapid switch settled on B')
  console.log('  ✅ Scenario F (rapid switch) passed')

  await page.close()

  // Scenario G: External Store update + parent re-render
  const externalPage = await fresh()
  const extNotes = externalPage.locator('textarea').nth(0)
  const extPlan = externalPage.locator('textarea').nth(2)

  // User edits local notes (dirty)
  await extNotes.fill('LOCAL UNSAVED NOTE')
  // External system updates Store and forces parent render
  await externalPage.evaluate(() => {
    window.harness.update(window.harness.aId, {
      notes: 'EXTERNAL CONFLICT NOTE',
      certificationPlan: 'EXTERNAL UPDATED PLAN'
    })
    window.harness.render(window.harness.aId)
  })
  await externalPage.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))

  // Clean plan followed external update
  assert.equal(await extPlan.inputValue(), 'EXTERNAL UPDATED PLAN', 'Scenario G: clean plan synced')
  // Dirty notes retained local draft
  assert.equal(await extNotes.inputValue(), 'LOCAL UNSAVED NOTE', 'Scenario G: dirty notes retained')
  // Conflict banner visible
  assert.equal(await externalPage.locator('[data-testid="assessment-conflict-banner"]').count(), 1, 'Scenario G: conflict banner visible')

  // Re-render again without changes: no loop, no extra warnings
  await externalPage.evaluate(() => window.harness.render(window.harness.aId))
  await externalPage.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))
  assert.equal(await externalPage.locator('[data-testid="assessment-conflict-banner"]').count(), 1, 'Scenario G: stable after repeat render')

  // Conflict discard button: resets draft to external and clears banner
  await externalPage.getByRole('button', { name: '放弃草稿并载入外部数据', exact: true }).click()
  assert.equal(await extNotes.inputValue(), 'EXTERNAL CONFLICT NOTE', 'Scenario G discard: reset to external')
  assert.equal(await externalPage.locator('[data-testid="assessment-conflict-banner"]').count(), 0, 'Scenario G discard: banner dismissed')
  console.log('  ✅ Scenario G passed (including clean sync, conflict detection, stable re-render, and discard reset)')

  await externalPage.close()
  console.log('\nAll Revision 001 Real Component Tests Succeeded!')
} finally {
  await browser.close()
}
