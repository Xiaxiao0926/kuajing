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
globalThis.fetch = async (url, options = {}) => {
  requests.push({ url, options })
  if (!options.method || options.method === 'GET') {
    return new Response(JSON.stringify({
      'server-only': { value: { restored: true }, updatedAt: 2000 },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

const persistence = await import('../ozon-react/src/utils/persist.js')

await persistence.syncFromServer()
assert.deepEqual(persistence.persistGet('server-only'), { restored: true })

localStorage.setItem('legacy-local', JSON.stringify({ migrated: true }))
assert.deepEqual(persistence.persistGet('legacy-local'), { migrated: true })
await persistence.flushPersistence()
const migrationWrite = requests.find(request => {
  if (request.options.method !== 'POST') return false
  return Boolean(JSON.parse(request.options.body).entries['legacy-local'])
})
assert.ok(migrationWrite, 'expected legacy local data to migrate to the server')

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

persistence.persistRemove('orders')
await persistence.flushPersistence()
const deleteWrite = requests.filter(request => request.options.method === 'POST').at(-1)
assert.equal(JSON.parse(deleteWrite.options.body).entries.orders.value, null)

console.log('web persistence tests passed')
