import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'
import { users } from '../../server/database/schema'

const mocks = vi.hoisted(() => {
  const returning = vi.fn()
  const where = vi.fn((_condition: SQL) => ({ returning }))
  const set = vi.fn(() => ({ where }))
  const update = vi.fn(() => ({ set }))
  return { returning, where, set, update }
})
vi.mock('../../server/database', () => ({ connectDatabase: () => ({ db: { update: mocks.update } }) }))
import { adminRepository } from '../../server/utils/admin-repository'

beforeEach(() => {
  vi.stubEnv('DATABASE_URL', 'postgresql://unused/test')
  mocks.returning.mockResolvedValue([{ id: 7 }])
})
afterEach(() => vi.unstubAllEnvs())

describe('admin password repository', () => {
  it('only changes the hash for the enabled administrator identified by the session', async () => {
    expect(await adminRepository.updatePassword(7, 'hashed-password')).toBe(true)
    expect(mocks.update).toHaveBeenCalledWith(users)
    expect(mocks.set).toHaveBeenCalledWith({ passwordHash: 'hashed-password' })
    const query = new PgDialect().sqlToQuery(mocks.where.mock.calls[0]![0])
    expect(query.sql).toContain('"users"."id" = $1')
    expect(query.sql).toContain('"users"."role" = $2')
    expect(query.sql).toContain('"users"."disabled" = $3')
    expect(query.params).toEqual([7, 'admin', false])
    expect(mocks.returning).toHaveBeenCalledWith({ id: users.id })
  })

  it('reports when the target was deleted, disabled or demoted before saving', async () => {
    mocks.returning.mockResolvedValue([])
    expect(await adminRepository.updatePassword(7, 'hashed-password')).toBe(false)
  })
})
