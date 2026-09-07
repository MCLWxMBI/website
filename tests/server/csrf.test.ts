import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { createEvent } from 'h3'
import { beforeAll, describe, expect, it } from 'vitest'
import { create, importEncryptSecret } from 'uncsrf'
import { useRuntimeConfig } from '../support/nitro-imports'
import csrfMiddleware from '../../node_modules/nuxt-csurf/dist/runtime/server/middleware/csrf.js'

// Public test fixture only. No environment files or application server are used.
const encryptSecret = 'x'.repeat(32)
const cookie = 'test-cookie-value'
let token: string
beforeAll(async () => {
  useRuntimeConfig.mockReturnValue({ csurf: {
    cookieKey: 'csrf', headerName: 'csrf-token', encryptSecret,
    methodsToProtect: ['POST', 'PUT', 'PATCH', 'DELETE']
  } })
  token = await create(cookie, await importEncryptSecret(encryptSecret))
})
function event(method: string, cookieValue?: string, tokenValue?: string) {
  const req = new IncomingMessage(new Socket())
  req.method = method
  req.url = method === 'DELETE' ? '/api/_auth/session' : '/api/admin/login'
  req.headers = {
    ...(cookieValue ? { cookie: `csrf=${cookieValue}` } : {}),
    ...(tokenValue ? { 'csrf-token': tokenValue } : {})
  }
  return createEvent(req, new ServerResponse(req))
}
describe.each(['POST', 'DELETE'])('%s CSRF middleware', (method) => {
  it('accepts a valid cookie/token pair', async () => {
    await expect(csrfMiddleware(event(method, cookie, token))).resolves.toBeUndefined()
  })
  it.each(['cookie', 'token', 'invalid', 'mismatched'])('rejects missing or invalid %s', async (kind) => {
    await expect(csrfMiddleware(event(method, kind === 'cookie' ? undefined : kind === 'mismatched' ? 'other-cookie' : cookie,
      kind === 'token' ? undefined : kind === 'invalid' ? 'invalid-token' : token))).rejects.toMatchObject({ statusCode: 403 })
  })
})
it('does not require a token for read-only requests', async () => {
  await expect(csrfMiddleware(event('GET'))).resolves.toBeUndefined()
})
