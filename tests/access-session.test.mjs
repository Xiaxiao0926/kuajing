import assert from 'node:assert/strict'

globalThis.window = {
  KUAJING_CONFIG: {
    apiBase: 'https://example.test/wp-json/kuajing/v1',
    authorized: false,
    sessionRequired: true,
  },
}

const requests = []
globalThis.fetch = async (url, options = {}) => {
  requests.push({ url, options })
  const authorized = options.method === 'POST'
  return new Response(JSON.stringify({ authorized }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

const access = await import('../ozon-react/src/utils/access.js')
const runtime = await import('../ozon-react/src/utils/runtime.js')

const initial = await access.checkAccessSession()
assert.equal(initial.authorized, false)
assert.equal(runtime.canUseServerPersistence(), false)

const unlocked = await access.unlockAccess('test-password')
assert.equal(unlocked.authorized, true)
assert.equal(runtime.canUseServerPersistence(), true)

const unlockRequest = requests.at(-1)
assert.equal(unlockRequest.url, 'https://example.test/wp-json/kuajing/v1/session')
assert.equal(unlockRequest.options.method, 'POST')
assert.equal(unlockRequest.options.credentials, 'same-origin')
assert.deepEqual(JSON.parse(unlockRequest.options.body), { password: 'test-password' })

console.log('access session tests passed')
