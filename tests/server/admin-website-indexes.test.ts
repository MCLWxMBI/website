import { describe, expect, it, vi } from 'vitest'
import type { WebsiteIndex } from '../../server/database/schema'
import {
  readAdminWebsiteIndexes,
  saveAdminWebsiteIndexes,
  WebsiteIndexConflictError,
  type AdminWebsiteIndexRepository
} from '../../server/services/admin-website-indexes'

const rows: WebsiteIndex[] = [
  { id: 2n, name: 'Alpha', indexUrl: 'https://alpha.example/consultations', active: true, notes: 'Checked weekly' },
  { id: 7n, name: 'Beta', indexUrl: 'https://beta.example/engage', active: false, notes: null }
]

function repository(): AdminWebsiteIndexRepository {
  return {
    all: vi.fn().mockResolvedValue(rows),
    applyBatch: vi.fn().mockResolvedValue(rows)
  }
}

describe('admin website index reads', () => {
  it('serializes bigint IDs and includes internal notes', async () => {
    await expect(readAdminWebsiteIndexes(repository())).resolves.toEqual([
      { id: '2', name: 'Alpha', indexUrl: 'https://alpha.example/consultations', active: true, notes: 'Checked weekly' },
      { id: '7', name: 'Beta', indexUrl: 'https://beta.example/engage', active: false, notes: null }
    ])
  })

  it('does not expose database errors', async () => {
    const repo = repository()
    vi.mocked(repo.all).mockRejectedValue(new Error('postgresql://admin:secret@database/echo'))
    await expect(readAdminWebsiteIndexes(repo)).rejects.toMatchObject({ statusCode: 503 })
    await expect(readAdminWebsiteIndexes(repo)).rejects.not.toThrow('secret')
  })
})

describe('admin website index saves', () => {
  it('normalizes a mixed batch and leaves new IDs for bigserial', async () => {
    const repo = repository()
    await saveAdminWebsiteIndexes({
      upserts: [
        { id: '2', name: '  Alpha updated  ', indexUrl: ' https://alpha.example/new ', active: false, notes: '  New note  ' },
        { name: 'New index', indexUrl: 'https://new.example/consultations', active: true, notes: '   ' }
      ],
      deleteIds: ['7']
    }, repo)

    expect(repo.applyBatch).toHaveBeenCalledWith([
      { id: 2n, name: 'Alpha updated', indexUrl: 'https://alpha.example/new', active: false, notes: 'New note' },
      { name: 'New index', indexUrl: 'https://new.example/consultations', active: true, notes: null }
    ], [7n])
    expect(vi.mocked(repo.applyBatch).mock.calls[0]![0][1]).not.toHaveProperty('id')
  })

  it.each([
    [{ upserts: [], deleteIds: [], extra: true }, 'upserts and deleteIds'],
    [{ upserts: [{ name: '', indexUrl: 'https://example.com', active: true, notes: null }], deleteIds: [] }, 'name'],
    [{ upserts: [{ name: 'Name', indexUrl: 'http://example.com', active: true, notes: null }], deleteIds: [] }, 'HTTPS'],
    [{ upserts: [{ name: 'Name', indexUrl: 'https://example.com', active: 'yes', notes: null }], deleteIds: [] }, 'Active'],
    [{ upserts: [{ id: '0', name: 'Name', indexUrl: 'https://example.com', active: true, notes: null }], deleteIds: [] }, 'positive'],
    [{ upserts: [{ id: '2', name: 'Name', indexUrl: 'https://example.com', active: true, notes: null }], deleteIds: ['2'] }, 'updated and deleted'],
    [{ upserts: [], deleteIds: ['2', '2'] }, 'duplicated']
  ])('rejects an invalid request without opening a transaction: %#', async (body, message) => {
    const repo = repository()
    await expect(saveAdminWebsiteIndexes(body, repo)).rejects.toMatchObject({ statusCode: 400 })
    await expect(saveAdminWebsiteIndexes(body, repo)).rejects.toThrow(message as string)
    expect(repo.applyBatch).not.toHaveBeenCalled()
  })

  it('returns a conflict for an existing ID deleted elsewhere', async () => {
    const repo = repository()
    vi.mocked(repo.applyBatch).mockRejectedValue(new WebsiteIndexConflictError())
    await expect(saveAdminWebsiteIndexes({ upserts: [], deleteIds: ['7'] }, repo))
      .rejects.toMatchObject({ statusCode: 409 })
  })

  it('returns a generic error when the transaction fails', async () => {
    const repo = repository()
    vi.mocked(repo.applyBatch).mockRejectedValue(new Error('database secret'))
    await expect(saveAdminWebsiteIndexes({ upserts: [], deleteIds: [] }, repo))
      .rejects.toMatchObject({ statusCode: 503 })
  })
})
