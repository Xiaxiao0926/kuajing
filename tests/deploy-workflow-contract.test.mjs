import assert from 'node:assert/strict'
import fs from 'node:fs'

const workflowPath = new URL('../.github/workflows/deploy-kuajing.yml', import.meta.url)
const workflow = fs.readFileSync(workflowPath, 'utf8')
const deployBlock = workflow.match(/\n  deploy:\n([\s\S]*)$/)?.[1] || ''
const verifyBlock = workflow.split('\n  deploy:\n')[0]

assert.match(workflow, /push:\s*[\s\S]*branches:\s*[\s\S]*- main/)
assert.match(workflow, /- ["']dev\/\*\*["']/)
assert.match(workflow, /workflow_dispatch:/)
assert.match(workflow, /\n  verify:\n/)
assert.match(workflow, /\n  deploy:\n/)
assert.match(deployBlock, /if:\s*github\.event_name == 'workflow_dispatch'/)
assert.match(deployBlock, /github\.ref == 'refs\/heads\/main'/)
assert.match(deployBlock, /needs:\s+verify/)
assert.doesNotMatch(verifyBlock, /FTP_SERVER|FTP_USERNAME|FTP_PASSWORD|lftp|Deploy plugin to Hostinger/)
assert.match(deployBlock, /FTP_SERVER|FTP_USERNAME|FTP_PASSWORD|lftp/)

console.log('deploy workflow contract tests passed')
