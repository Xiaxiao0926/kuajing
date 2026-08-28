import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'

const pluginPath = new URL('../wordpress/kuajing-persistence/kuajing-persistence.php', import.meta.url)
const plugin = fs.readFileSync(pluginPath, 'utf8')

for (const marker of [
  'revision bigint(20) unsigned NOT NULL DEFAULT 1',
  'updated_by_device varchar(191) NOT NULL DEFAULT',
  'STATE_VERSIONS_SUFFIX',
  'AUDIT_EVENTS_SUFFIX',
  "'/state/history'",
  "'/state/restore'",
  "'status' => 409",
  "'revision_conflict'",
  "'duplicate_state_key'",
  'START TRANSACTION',
  'FOR UPDATE',
  "'RESTORE'",
]) {
  assert.match(plugin, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `missing PHP contract marker: ${marker}`)
}
assert.doesNotMatch(plugin, /DROP\s+TABLE/i, 'state safety migration must not drop tables')

class StateSafetyModel {
  constructor() {
    this.state = new Map()
    this.history = new Map()
  }

  seed(key, revision, value) {
    this.state.set(key, { revision, value })
    this.history.set(`${key}:${revision}`, structuredClone(value))
  }

  write(key, baseRevision, value, deviceId) {
    const current = this.state.get(key)
    const currentRevision = current?.revision || 0
    if (baseRevision !== currentRevision) {
      return { status: 409, server: structuredClone(current) }
    }
    const next = { revision: currentRevision + 1, value: structuredClone(value), deviceId }
    this.state.set(key, next)
    this.history.set(`${key}:${next.revision}`, structuredClone(value))
    return { status: 200, value: structuredClone(next) }
  }

  restore(key, targetRevision, baseRevision, deviceId) {
    const current = this.state.get(key)
    const currentRevision = current?.revision || 0
    if (baseRevision !== currentRevision) {
      return { status: 409, server: structuredClone(current) }
    }
    const value = this.history.get(`${key}:${targetRevision}`)
    assert.notEqual(value, undefined, `history revision ${targetRevision} should exist`)
    return this.write(key, baseRevision, value, deviceId)
  }
}

const model = new StateSafetyModel()
model.seed('orders', 10, { source: 'r10' })
const normal = model.write('orders', 10, { source: 'r11' }, 'device-a')
assert.equal(normal.status, 200, 'A normal write must return 200')
assert.equal(normal.value.revision, 11)

const concurrent = new StateSafetyModel()
concurrent.seed('orders', 10, { source: 'r10' })
const clientA = concurrent.write('orders', 10, { source: 'A' }, 'device-a')
const clientB = concurrent.write('orders', 10, { source: 'B' }, 'device-b')
assert.equal(clientA.status, 200, 'client A must write from revision 10')
assert.equal(clientB.status, 409, 'client B must be rejected from stale revision 10')
assert.deepEqual(concurrent.state.get('orders').value, { source: 'A' }, 'server payload must remain client A payload')

assert.deepEqual(concurrent.history.get('orders:10'), { source: 'r10' })
assert.deepEqual(concurrent.history.get('orders:11'), { source: 'A' })

const restoreModel = new StateSafetyModel()
restoreModel.seed('orders', 8, { source: 'r8' })
for (let revision = 9; revision <= 15; revision += 1) {
  restoreModel.write('orders', revision - 1, { source: `r${revision}` }, 'device-a')
}
const restored = restoreModel.restore('orders', 8, 15, 'device-b')
assert.equal(restored.status, 200, 'restore from current revision 15 must return 200')
assert.equal(restored.value.revision, 16)
assert.deepEqual(restored.value.value, { source: 'r8' })
const staleRestore = restoreModel.restore('orders', 8, 15, 'device-c')
assert.equal(staleRestore.status, 409, 'restore opened at revision 15 must reject after revision 16')

const samples = Array.from({ length: 11 }, (_, index) => ({
  key: `sample-${index + 1}`,
  value: { index, payload: `value-${index + 1}` },
}))
const beforeHash = crypto.createHash('sha256').update(JSON.stringify(samples)).digest('hex')
const migrated = samples.map((sample) => ({ ...sample, revision: 1, updatedByDevice: '' }))
const afterHash = crypto.createHash('sha256').update(JSON.stringify(migrated.map(({ revision, updatedByDevice, ...sample }) => sample))).digest('hex')
assert.equal(afterHash, beforeHash, 'migration must preserve all 11 payloads exactly')

console.log('state safety contract tests passed')
