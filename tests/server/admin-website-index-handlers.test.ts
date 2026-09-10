import { beforeEach, describe, expect, it, vi } from 'vitest'

const repository = vi.hoisted(() => ({ all: vi.fn(), applyBatch: vi.fn() }))
const requireAdmin = vi.hoisted(() => vi.fn())
const readBody = vi.hoisted(() => vi.fn())

vi.mock('../../server/utils/website-index-repository', () => ({ adminWebsiteIndexRepository: repository }))
vi.mock('../../server/utils/require-admin', () => ({ requireAdmin }))
vi.mock('h3', async (original) => ({
  ...await original<typeof import('h3')>(),
  readBody
}))

import readIndexes from '../../server/api/admin/indexes.get'
import saveIndexes from '../../server/api/admin/indexes.put'

const event = {} as Parameters<typeof readIndexes>[0]
const row = { id: 1n, name: 'Example', indexUrl: 'https://example.com', active: true, notes: 'Internal' }

beforeEach(() => {
  requireAdmin.mockResolvedValue({ user: { id: 4, username: 'admin', role: 'admin' } })
  repository.all.mockResolvedValue([row])
  repository.applyBatch.mockResolvedValue([row])
  readBody.mockResolvedValue({ upserts: [], deleteIds: [] })
})

describe('admin website index handlers', () => {
  it('authorizes reads and returns notes', async () => {
    await expect(readIndexes(event)).resolves.toEqual([
      { id: '1', name: 'Example', indexUrl: 'https://example.com', active: true, notes: 'Internal' }
    ])
    expect(requireAdmin).toHaveBeenCalledWith(event)
  })

  it('authorizes before reading and applying a batch', async () => {
    await saveIndexes(event)
    expect(requireAdmin.mock.invocationCallOrder[0]).toBeLessThan(readBody.mock.invocationCallOrder[0]!)
    expect(repository.applyBatch).toHaveBeenCalledWith([], [])
  })
})
