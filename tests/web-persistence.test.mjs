import assert from 'node:assert/strict'

class MemoryStorage {
  constructor() { this.values = new Map() }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null }
  setItem(key, value) { this.values.set(key, String(value)) }
  removeItem(key) { this.values.delete(key) }
}

globalThis.window = {
  KUAJING_CONFIG: {
    apiBase: 'https://example.test/wp-json/kuajing/v1',
    nonce: 'test-nonce',
    authorized: true,
  },
}
globalThis.localStorage = new MemoryStorage()

const requests = []
const serverBackups = []
const serverState = new Map([
  ['server-only', { value: { restored: true }, revision: 4, updatedAt: 2000, updatedByDevice: 'seed-device' }],
  ['pending-before-sync', { value: [{ id: 'SERVER_CURRENT' }], revision: 3, updatedAt: 1000, updatedByDevice: 'server-device' }],
  ['orders', { value: [{ id: 'SERVER_NEW' }], revision: 4, updatedAt: 1000, updatedByDevice: 'server-device' }],
])
globalThis.fetch = async (url, options = {}) => {
  requests.push({ url, options })
  if (String(url).includes('/state/backup') && options.method === 'POST') {
    const payload = JSON.parse(options.body)
    const backup = {
      id: serverBackups.length + 1,
      key: payload.key,
      value: payload.value,
      baseRevision: payload.baseRevision,
      serverRevision: serverState.get(payload.key)?.revision || 0,
      clientUpdatedAt: payload.clientUpdatedAt,
      deviceId: payload.deviceId,
      reason: payload.reason,
    }
    serverBackups.push(backup)
    return new Response(JSON.stringify({ success: true, backup }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  if (!options.method || options.method === 'GET') {
    return new Response(JSON.stringify(Object.fromEntries(serverState)), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  const payload = JSON.parse(options.body)
  const saved = {}
  for (const [key, entry] of Object.entries(payload.entries || {})) {
    const current = serverState.get(key)
    const currentRevision = current?.revision || 0
    if (entry.baseRevision !== currentRevision) {
      return new Response(JSON.stringify({
        code: 'revision_conflict',
        message: 'State changed on the server.',
        data: {
          key,
          clientRevision: entry.baseRevision,
          serverRevision: currentRevision,
          serverValue: current?.value ?? null,
          serverUpdatedAt: current?.updatedAt || 0,
          serverUpdatedByDevice: current?.updatedByDevice || '',
        },
      }), { status: 409, headers: { 'Content-Type': 'application/json' } })
    }
    const next = {
      value: entry.value,
      revision: currentRevision + 1,
      updatedAt: 3000 + currentRevision,
      updatedByDevice: entry.deviceId,
    }
    serverState.set(key, next)
    saved[key] = { key, ...next }
  }
  return new Response(JSON.stringify({ success: true, saved }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

localStorage.setItem('orders', JSON.stringify([{ id: 'LOCAL_OLD' }]))
localStorage.setItem('__kuajing_updated__:orders', '9000')
const persistence = await import('../ozon-react/src/utils/persist.js')

persistence.persistSet('pending-before-sync', [{ id: 'LOCAL_EDIT' }])
assert.equal(persistence.getPendingPersistence('pending-before-sync').baseRevision, 0)
await persistence.syncFromServer()
assert.deepEqual(persistence.persistGet('server-only'), { restored: true })
assert.equal(persistence.getPersistenceMetadata('server-only').revision, 4)
assert.deepEqual(persistence.persistGet('orders'), [{ id: 'SERVER_NEW' }])
assert.equal(persistence.getPendingPersistence('orders'), null)
assert.equal(persistence.getPersistenceStatus().state, 'conflict')
assert.equal(persistence.getPersistenceStatus().details.localOnly, true)
assert.equal(persistence.getPersistenceStatus().details.backupSaved, true)
assert.deepEqual(serverBackups.find(backup => backup.key === 'orders')?.value, [{ id: 'LOCAL_OLD' }])
assert.deepEqual(await persistence.copyPendingValue('orders'), JSON.stringify([{ id: 'LOCAL_OLD' }], null, 2))
await persistence.reloadServerValue('orders')
assert.match(requests[0].url, /^https:\/\/example\.test\/wp-json\/kuajing\/v1\/state\?_=[0-9]+$/)
assert.equal(requests[0].options.method, undefined)

await persistence.flushPersistence()
const stalePendingWrite = requests.find(request => {
  if (request.options.method !== 'POST') return false
  return Boolean(JSON.parse(request.options.body).entries?.['pending-before-sync'])
})
assert.ok(stalePendingWrite, 'expected the pre-sync edit to be attempted with its original base revision')
assert.equal(JSON.parse(stalePendingWrite.options.body).entries['pending-before-sync'].baseRevision, 0)
assert.deepEqual(serverState.get('pending-before-sync').value, [{ id: 'SERVER_CURRENT' }])
assert.deepEqual(serverBackups.find(backup => backup.key === 'pending-before-sync')?.value, [{ id: 'LOCAL_EDIT' }])
await persistence.reloadServerValue('pending-before-sync')

localStorage.setItem('legacy-local', JSON.stringify({ migrated: true }))
assert.deepEqual(persistence.persistGet('legacy-local'), { migrated: true })
await persistence.flushPersistence()
const migrationWrite = requests.find(request => {
  if (request.options.method !== 'POST') return false
  return Boolean(JSON.parse(request.options.body).entries?.['legacy-local'])
})
assert.ok(migrationWrite, 'expected legacy local data to migrate to the server')
assert.equal(JSON.parse(migrationWrite.options.body).entries['legacy-local'].baseRevision, 0)
assert.ok(JSON.parse(migrationWrite.options.body).entries['legacy-local'].deviceId)

persistence.persistSet('orders', [{ id: 1 }])
await persistence.flushPersistence()

const write = requests.find(request => {
  if (request.options.method !== 'POST') return false
  return Boolean(JSON.parse(request.options.body).entries?.orders)
})
assert.ok(write, 'expected a server persistence POST')
assert.equal(write.options.headers.get('X-WP-Nonce'), 'test-nonce')
assert.equal(write.options.credentials, 'same-origin')
const payload = JSON.parse(write.options.body)
assert.deepEqual(payload.entries.orders.value, [{ id: 1 }])
assert.equal(payload.entries.orders.baseRevision, 4)
assert.ok(payload.entries.orders.deviceId)
assert.equal(persistence.getPersistenceMetadata('orders').revision, 5)

persistence.persistRemove('orders')
await persistence.flushPersistence()
const deleteWrite = requests.filter(request => request.options.method === 'POST').at(-1)
assert.equal(JSON.parse(deleteWrite.options.body).entries.orders.value, null)
assert.equal(JSON.parse(deleteWrite.options.body).entries.orders.baseRevision, 5)
assert.equal(persistence.getPersistenceMetadata('orders').revision, 6)

serverState.set('orders', { value: [{ id: 99 }], revision: 7, updatedAt: 4000, updatedByDevice: 'other-device' })
persistence.persistSet('orders', [{ id: 2 }])
persistence.persistSet('parallel-safe', { saved: true })
await persistence.flushPersistence()
assert.equal(persistence.getPersistenceStatus().state, 'conflict')
assert.equal(persistence.getPersistenceStatus().details.serverRevision, 7)
assert.equal(persistence.getPersistenceStatus().details.backupSaved, true)
assert.equal(persistence.getPendingPersistence('orders'), null)
assert.match(await persistence.copyPendingValue('orders'), /"id": 2/)
assert.deepEqual(serverBackups.filter(backup => backup.key === 'orders').at(-1)?.value, [{ id: 2 }])
assert.deepEqual(serverState.get('parallel-safe').value, { saved: true }, 'a conflict must not block another state key')
await persistence.reloadServerValue('orders')
assert.deepEqual(persistence.persistGet('orders'), [{ id: 99 }])
assert.equal(persistence.getPersistenceMetadata('orders').revision, 7)
assert.equal(persistence.getPendingPersistence('orders'), null)

console.log('web persistence tests passed')
