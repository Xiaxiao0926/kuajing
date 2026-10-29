// verify-runner-fault-injection.mjs — Requirement 39 独立验证脚本
// 目标：验证测试 runner 在缺少依赖时报告 not_run（不伪造全绿），且在发生断言失败时以非零码退出（不吞错）。

import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../../../..')
const testPath = path.join(root, 'tests/ia-project-compliance-draft.test.mjs')

console.log('=== Requirement 39: Runner Fault Injection & Preflight Verification ===\n')

const results = {
  missingDepCheck: {},
  faultInjectionCheck: {},
  passed: false,
}

// Case 1: 缺少依赖环境时的行为验证
console.log('--- Case 1: CODEX_NODE_MODULES 缺失时预检与报告验证 ---')
const envNoCodex = { ...process.env }
delete envNoCodex.CODEX_NODE_MODULES

const runNoCodex = spawnSync(process.execPath, [testPath], {
  cwd: root,
  env: envNoCodex,
  encoding: 'utf-8',
})

const noCodexStdout = runNoCodex.stdout || ''
const noCodexStderr = runNoCodex.stderr || ''
const noCodexOut = noCodexStdout + noCodexStderr

const reportsNotRun = noCodexOut.includes('not_run')
const doesNotSayAllPassed = !noCodexOut.includes('ALL SCENARIOS') && !noCodexOut.includes('ALL DRAFT PROTECTION TESTS PASSED')
const exitedZeroForUnit = runNoCodex.status === 0

results.missingDepCheck = {
  exitCode: runNoCodex.status,
  reportsNotRun,
  doesNotSayAllPassed,
  exitedZeroForUnit,
  passed: reportsNotRun && doesNotSayAllPassed && exitedZeroForUnit,
}

console.log(`  Exit code: ${runNoCodex.status}`)
console.log(`  Reports not_run: ${reportsNotRun}`)
console.log(`  Does NOT claim all passed: ${doesNotSayAllPassed}`)
console.log(`  Result: ${results.missingDepCheck.passed ? '✅ PASSED' : '❌ FAILED'}\n`)

// Case 2: 注入断言失败时的非零退出验证
console.log('--- Case 2: 注入浏览器断言失败时 runner 失败检测验证 ---')
if (!process.env.CODEX_NODE_MODULES) {
  console.log('  ⚠️ CODEX_NODE_MODULES 未在当前环境变量中，使用本机默认路径')
}
const codexModules = process.env.CODEX_NODE_MODULES || 'C:\\Users\\Administrator\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules'

const runInjected = spawnSync(process.execPath, [testPath], {
  cwd: root,
  env: {
    ...process.env,
    CODEX_NODE_MODULES: codexModules,
    TEST_INJECT_FAILURE: '1',
  },
  encoding: 'utf-8',
})

const injectedStdout = runInjected.stdout || ''
const injectedStderr = runInjected.stderr || ''
const injectedOut = injectedStdout + injectedStderr

const errorReported = injectedOut.includes('FAULT INJECTION') || injectedOut.includes('AssertionError')
const injectedNoAllPassed = !injectedOut.includes('ALL SCENARIOS') && !injectedOut.includes('ALL DRAFT PROTECTION TESTS PASSED')
const exitedNonZero = runInjected.status !== 0

results.faultInjectionCheck = {
  exitCode: runInjected.status,
  errorReported,
  injectedNoAllPassed,
  exitedNonZero,
  passed: errorReported && injectedNoAllPassed && exitedNonZero,
}

console.log(`  Exit code: ${runInjected.status} (expected non-zero)`)
console.log(`  Error correctly reported in output: ${errorReported}`)
console.log(`  Does NOT claim all passed: ${injectedNoAllPassed}`)
console.log(`  Result: ${results.faultInjectionCheck.passed ? '✅ PASSED' : '❌ FAILED'}\n`)

results.passed = results.missingDepCheck.passed && results.faultInjectionCheck.passed

fs.writeFileSync(
  path.join(here, 'check-runner-fault-injection.json'),
  JSON.stringify(results, null, 2) + '\n'
)

console.log(`Overall Requirement 39 status: ${results.passed ? '✅ ALL PASSED' : '❌ FAILED'}`)
process.exit(results.passed ? 0 : 1)
