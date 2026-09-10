import { describe, expect, it, vi } from 'vitest'
import type { connectDatabase } from '../../server/database'
import { websiteIndexes } from '../../server/database/schema'
import { WebsiteIndexConflictError } from '../../server/services/admin-website-indexes'
import {
  createAdminWebsiteIndexRepository,
  createWebsiteIndexRepository
} from '../../server/utils/website-index-repository'

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

describe('admin website index repository', () => {
  it('applies additions, updates, and deletions inside one transaction', async () => {
    const finalRows = [
      { id: 2n, name: 'Updated', indexUrl: 'https://updated.example', active: false, notes: 'Note' },
      { id: 10n, name: 'New', indexUrl: 'https://new.example', active: true, notes: null }
    ]
    const whereExisting = vi.fn().mockResolvedValue([{ id: 2n }, { id: 7n }])
    const orderBy = vi.fn().mockResolvedValue(finalRows)
    const select = vi.fn()
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ where: whereExisting })) }))
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ orderBy })) }))
    const insertValues = vi.fn().mockResolvedValue(undefined)
    const updateWhere = vi.fn().mockResolvedValue(undefined)
    const updateSet = vi.fn(() => ({ where: updateWhere }))
    const deleteWhere = vi.fn().mockResolvedValue(undefined)
    const tx = {
      select,
      insert: vi.fn(() => ({ values: insertValues })),
      update: vi.fn(() => ({ set: updateSet })),
      delete: vi.fn(() => ({ where: deleteWhere }))
    }
    const transaction = vi.fn(async (callback: (transactionClient: typeof tx) => unknown) => callback(tx))
    const db = { transaction } as unknown as ReturnType<typeof connectDatabase>['db']

    const result = await createAdminWebsiteIndexRepository(db).applyBatch([
      { id: 2n, name: 'Updated', indexUrl: 'https://updated.example', active: false, notes: 'Note' },
      { name: 'New', indexUrl: 'https://new.example', active: true, notes: null }
    ], [7n])

    expect(result).toEqual(finalRows)
    expect(transaction).toHaveBeenCalledOnce()
    expect(insertValues).toHaveBeenCalledWith({
      name: 'New', indexUrl: 'https://new.example', active: true, notes: null
    })
    expect(insertValues.mock.calls[0]![0]).not.toHaveProperty('id')
    expect(updateSet).toHaveBeenCalledWith({
      name: 'Updated', indexUrl: 'https://updated.example', active: false, notes: 'Note'
    })
    expect(deleteWhere).toHaveBeenCalledOnce()
    expect(orderBy).toHaveBeenCalledOnce()
  })

  it('aborts the transaction when an expected existing ID is missing', async () => {
    const tx = {
      select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })) }))
    }
    const transaction = vi.fn(async (callback: (transactionClient: typeof tx) => unknown) => callback(tx))
    const db = { transaction } as unknown as ReturnType<typeof connectDatabase>['db']

    await expect(createAdminWebsiteIndexRepository(db).applyBatch([
      { id: 99n, name: 'Missing', indexUrl: 'https://missing.example', active: true, notes: null }
    ], [])).rejects.toBeInstanceOf(WebsiteIndexConflictError)
    expect(transaction).toHaveBeenCalledOnce()
  })
})
