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
const serverState = new Map([
  ['server-only', { value: { restored: true }, revision: 4, updatedAt: 2000, updatedByDevice: 'seed-device' }],
])
globalThis.fetch = async (url, options = {}) => {
  requests.push({ url, options })
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

const persistence = await import('../ozon-react/src/utils/persist.js')

await persistence.syncFromServer()
assert.deepEqual(persistence.persistGet('server-only'), { restored: true })
assert.equal(persistence.getPersistenceMetadata('server-only').revision, 4)
assert.match(requests[0].url, /^https:\/\/example\.test\/wp-json\/kuajing\/v1\/state\?_=[0-9]+$/)
assert.equal(requests[0].options.method, undefined)

localStorage.setItem('legacy-local', JSON.stringify({ migrated: true }))
assert.deepEqual(persistence.persistGet('legacy-local'), { migrated: true })
await persistence.flushPersistence()
const migrationWrite = requests.find(request => {
  if (request.options.method !== 'POST') return false
  return Boolean(JSON.parse(request.options.body).entries['legacy-local'])
})
assert.ok(migrationWrite, 'expected legacy local data to migrate to the server')
assert.equal(JSON.parse(migrationWrite.options.body).entries['legacy-local'].baseRevision, 0)
assert.ok(JSON.parse(migrationWrite.options.body).entries['legacy-local'].deviceId)

persistence.persistSet('orders', [{ id: 1 }])
await persistence.flushPersistence()

const write = requests.find(request => {
  if (request.options.method !== 'POST') return false
  return Boolean(JSON.parse(request.options.body).entries.orders)
})
assert.ok(write, 'expected a server persistence POST')
assert.equal(write.options.headers.get('X-WP-Nonce'), 'test-nonce')
assert.equal(write.options.credentials, 'same-origin')
const payload = JSON.parse(write.options.body)
assert.deepEqual(payload.entries.orders.value, [{ id: 1 }])
assert.equal(payload.entries.orders.baseRevision, 0)
assert.ok(payload.entries.orders.deviceId)
assert.equal(persistence.getPersistenceMetadata('orders').revision, 1)

persistence.persistRemove('orders')
await persistence.flushPersistence()
const deleteWrite = requests.filter(request => request.options.method === 'POST').at(-1)
assert.equal(JSON.parse(deleteWrite.options.body).entries.orders.value, null)
assert.equal(JSON.parse(deleteWrite.options.body).entries.orders.baseRevision, 1)
assert.equal(persistence.getPersistenceMetadata('orders').revision, 2)

serverState.set('orders', { value: [{ id: 99 }], revision: 3, updatedAt: 4000, updatedByDevice: 'other-device' })
persistence.persistSet('orders', [{ id: 2 }])
await persistence.flushPersistence()
assert.equal(persistence.getPersistenceStatus().state, 'conflict')
assert.equal(persistence.getPersistenceStatus().details.serverRevision, 3)
assert.equal(persistence.getPendingPersistence('orders').baseRevision, 2)
await persistence.reloadServerValue('orders')
assert.deepEqual(persistence.persistGet('orders'), [{ id: 99 }])
assert.equal(persistence.getPersistenceMetadata('orders').revision, 3)
assert.equal(persistence.getPendingPersistence('orders'), null)

console.log('web persistence tests passed')
