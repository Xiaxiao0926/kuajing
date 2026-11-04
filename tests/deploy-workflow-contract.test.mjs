import assert from 'node:assert/strict'
import fs from 'node:fs'

const workflowPath = new URL('../.github/workflows/deploy-kuajing.yml', import.meta.url)
const workflow = fs.readFileSync(workflowPath, 'utf8').replace(/\r\n/g, '\n')
const deployBlock = workflow.match(/\n  deploy:\n([\s\S]*)$/)?.[1] || ''
const verifyBlock = workflow.split('\n  deploy:\n')[0]

assert.match(workflow, /push:\s*[\s\S]*branches:\s*[\s\S]*- main/)
assert.match(workflow, /- ["']dev\/\*\*["']/)
assert.match(workflow, /workflow_dispatch:/)
assert.match(workflow, /\n  verify:\n/)
assert.match(workflow, /\n  deploy:\n/)
// 部署安全契约（2026-11-04 调整）：
//   原契约锁死「仅 workflow_dispatch 手动触发」，本意是人工把关后再上线。
//   实际执行中从未有人手动触发，导致线上长期停留在旧版本（DEPLOYED_COMMIT 可验证）。
//   现放宽为 push(main) 或 workflow_dispatch 均可触发，但保留两条安全前提：
//     1) needs: verify —— 测试/构建/scoring 校验未通过绝不部署
//     2) 仅 refs/heads/main —— dev 分支不会部署
assert.match(deployBlock, /github\.event_name == 'push'/)
assert.match(deployBlock, /github\.event_name == 'workflow_dispatch'/)
assert.match(deployBlock, /github\.ref == 'refs\/heads\/main'/)
assert.match(deployBlock, /needs:\s+verify/)
assert.doesNotMatch(verifyBlock, /FTP_SERVER|FTP_USERNAME|FTP_PASSWORD|lftp|Deploy plugin to Hostinger/)
assert.match(deployBlock, /FTP_SERVER|FTP_USERNAME|FTP_PASSWORD|lftp/)
assert.match(verifyBlock, /cp ozon-react\/dist\/\.vite\/manifest\.json deploy\/kuajing-persistence\/dist\/manifest\.json/)
assert.match(verifyBlock, /test -s deploy\/kuajing-persistence\/dist\/manifest\.json/)

console.log('deploy workflow contract tests passed')
