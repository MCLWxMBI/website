import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import type { User } from '../../server/database/schema'
import { authenticateAdmin, authorizeAdmin } from '../../server/services/admin-auth'
import { getUserSession, replaceUserSession, clearUserSession } from '../support/nitro-imports'
import { logoutAdmin } from '../../app/utils/admin-logout'

const repository = vi.hoisted(() => ({ byId: vi.fn(), byUsername: vi.fn() }))
vi.mock('../../server/utils/admin-repository', () => ({ adminRepository: repository }))
vi.mock('h3', async (original) => ({ ...await original<typeof import('h3')>(), readBody: vi.fn(async () => body) }))
vi.mock('../../node_modules/nuxt-auth-utils/dist/runtime/server/utils/session.js', async () => ({ clearUserSession: (await import('../support/nitro-imports')).clearUserSession }))
import login from '../../server/api/admin/login.post'
import sessionHandler from '../../server/api/admin/session.get'
import logout from '../../node_modules/nuxt-auth-utils/dist/runtime/server/api/session.delete.js'
let body: unknown
let account: User
const event = {} as Parameters<typeof login>[0]
const now = Date.UTC(2026, 8, 7)
const identity = { id: 1, username: 'admin', role: 'admin' as const }
const session = () => ({ user: identity, expiresAt: now + 86_400_000 })

beforeAll(async () => {
  account = { ...identity, passwordHash: await new Hash(new Scrypt({})).make(' password '), disabled: false, createdAt: new Date(now) }
})
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(now)
  repository.byUsername.mockResolvedValue({ ...account })
  repository.byId.mockResolvedValue({ ...account })
  getUserSession.mockResolvedValue(session())
  body = { username: ' ADMIN ', password: ' password ' }
})
afterEach(() => vi.useRealTimers())

describe('login handler and password compatibility', () => {
  it('normalizes usernames, preserves passwords and replaces the session for 24 hours', async () => {
    expect(await login(event)).toEqual(session())
    expect(repository.byUsername).toHaveBeenCalledWith('admin')
    expect(replaceUserSession).toHaveBeenCalledWith(event, session(), { maxAge: 86_400 })
    expect(JSON.stringify(replaceUserSession.mock.calls)).not.toContain(account.passwordHash)
  })
  it.each([null, {}, { username: 1, password: 'x' }, { username: 'admin', password: [] }])('rejects malformed input %j', async (value) => {
    body = value
    await expect(login(event)).rejects.toMatchObject({ statusCode: 400 })
    expect(replaceUserSession).not.toHaveBeenCalled()
  })
  it.each(['unknown', 'disabled', 'non-admin', 'wrong-password', 'empty-password', 'invalid-username'])('rejects %s without creating a session', async (scenario) => {
    if (scenario === 'unknown') repository.byUsername.mockResolvedValue(undefined)
    if (scenario === 'disabled') repository.byUsername.mockResolvedValue({ ...account, disabled: true })
    if (scenario === 'non-admin') repository.byUsername.mockResolvedValue({ ...account, role: 'user' })
    if (scenario === 'wrong-password') body = { username: 'admin', password: 'password' }
    if (scenario === 'empty-password') body = { username: 'admin', password: '' }
    if (scenario === 'invalid-username') body = { username: '../admin', password: 'password' }
    await expect(login(event)).rejects.toMatchObject({ statusCode: 401, statusMessage: 'Invalid username or password.' })
    expect(replaceUserSession).not.toHaveBeenCalled()
  })
  it('sanitizes database errors', async () => {
    repository.byUsername.mockRejectedValue(new Error('sensitive connection details'))
    await expect(login(event)).rejects.toMatchObject({ statusCode: 503 })
    await expect(login(event)).rejects.not.toThrow('sensitive')
    expect(replaceUserSession).not.toHaveBeenCalled()
  })
  it('starts a new expiry on a fresh login', async () => {
    vi.setSystemTime(now + 1000)
    expect((await authenticateAdmin(body, repository)).expiresAt).toBe(now + 1000 + 86_400_000)
  })
})

describe('server authorization', () => {
  it('accepts immediately before expiry without extending the session', async () => {
    vi.setSystemTime(session().expiresAt - 1)
    expect(await sessionHandler(event)).toEqual(session())
    expect(replaceUserSession).not.toHaveBeenCalled()
  })
  it.each([0, 1])('rejects at or after expiry (+%i ms)', async (offset) => {
    vi.setSystemTime(session().expiresAt + offset)
    await expect(sessionHandler(event)).rejects.toMatchObject({ statusCode: 401 })
    expect(clearUserSession).toHaveBeenCalledWith(event)
    expect(repository.byId).not.toHaveBeenCalled()
  })
  it.each([{}, { user: identity }, { ...session(), expiresAt: NaN }])('rejects missing or malformed sessions %j', async (value) => {
    getUserSession.mockResolvedValue(value)
    await expect(sessionHandler(event)).rejects.toMatchObject({ statusCode: 401 })
  })
  it.each(['deleted', 'disabled', 'demoted'])('rejects an account that is %s', async (state) => {
    repository.byId.mockResolvedValue(state === 'deleted' ? undefined : { ...account, disabled: state === 'disabled', role: state === 'demoted' ? 'user' : 'admin' })
    await expect(sessionHandler(event)).rejects.toMatchObject({ statusCode: 401 })
  })
  it('fails closed on database failure without disclosing details', async () => {
    repository.byId.mockRejectedValue(new Error('sensitive database URL'))
    await expect(authorizeAdmin(session(), repository)).rejects.toMatchObject({ statusCode: 503 })
    await expect(authorizeAdmin(session(), repository)).rejects.not.toThrow('sensitive')
  })
})

describe('logout integration', () => {
  it('clears the server session before refreshing local state', async () => {
    const refresh = vi.fn()
    await logoutAdmin(() => logout(event), refresh)
    expect(clearUserSession).toHaveBeenCalledWith(event)
    expect(refresh).toHaveBeenCalledOnce()
    expect(clearUserSession.mock.invocationCallOrder[0]).toBeLessThan(refresh.mock.invocationCallOrder[0]!)
  })
  it('preserves local state and propagates failed deletion for UI feedback', async () => {
    const refresh = vi.fn()
    const failure = new Error('CSRF rejected')
    await expect(logoutAdmin(() => Promise.reject(failure), refresh)).rejects.toBe(failure)
    expect(refresh).not.toHaveBeenCalled()
  })
})
