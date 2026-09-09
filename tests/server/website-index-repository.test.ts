import { describe, expect, it, vi } from 'vitest'
import type { connectDatabase } from '../../server/database'
import { websiteIndexes } from '../../server/database/schema'
import { createWebsiteIndexRepository } from '../../server/utils/website-index-repository'

describe('website index repository', () => {
  it('selects public columns only and applies name and ID ordering', async () => {
    const rows = [{ id: 1n, name: 'Alpha', indexUrl: 'https://example.com', active: true }]
    const orderBy = vi.fn().mockResolvedValue(rows)
    const from = vi.fn(() => ({ orderBy }))
    const select = vi.fn(() => ({ from }))
    const db = { select } as unknown as ReturnType<typeof connectDatabase>['db']

    await expect(createWebsiteIndexRepository(db).all()).resolves.toEqual(rows)
    expect(select).toHaveBeenCalledWith({
      id: websiteIndexes.id,
      name: websiteIndexes.name,
      indexUrl: websiteIndexes.indexUrl,
      active: websiteIndexes.active
    })
    expect(from).toHaveBeenCalledWith(websiteIndexes)
    expect(orderBy).toHaveBeenCalledOnce()
    expect(orderBy.mock.calls[0]).toHaveLength(2)
  })
})
