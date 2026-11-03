import { describe, expect, it, vi } from 'vitest'
import type { WebsiteIndex } from '../../server/database/schema'
import {
  readAdminWebsiteIndexes,
  saveAdminWebsiteIndexes,
  WebsiteIndexConflictError,
  WebsiteIndexInUseError,
  type AdminWebsiteIndexRepository
} from '../../server/services/admin-website-indexes'

const rows: WebsiteIndex[] = [
  { id: 2n, name: 'Alpha', indexUrl: 'https://alpha.example/consultations', active: true, notes: 'Checked weekly', tags: [] },
  { id: 7n, name: 'Beta', indexUrl: 'https://beta.example/engage', active: false, notes: null, tags: [] }
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
      { id: '2', name: 'Alpha', indexUrl: 'https://alpha.example/consultations', active: true, notes: 'Checked weekly', tags: [] },
      { id: '7', name: 'Beta', indexUrl: 'https://beta.example/engage', active: false, notes: null, tags: [] }
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
  it('normalizes feature labels and leaves omitted tags untouched', async () => {
    const repo = repository()
    await saveAdminWebsiteIndexes({ upserts: [{ id: '2', expectedActive: true, name: 'Alpha', indexUrl: 'https://alpha.example', active: true, notes: null,
      tags: [' Login required ', 'login required', 'Online submission'] }], deleteIds: [] }, repo)
    expect(vi.mocked(repo.applyBatch).mock.calls[0]?.[0][0]?.tags).toEqual(['Login required', 'Online submission'])
    await saveAdminWebsiteIndexes({ upserts: [{ id: '2', expectedActive: true, name: 'Alpha', indexUrl: 'https://alpha.example', active: true, notes: null }], deleteIds: [] }, repo)
    expect(vi.mocked(repo.applyBatch).mock.calls[1]?.[0][0]).not.toHaveProperty('tags')
  })
  it('reports source-in-use conflicts distinctly', async () => {
    const repo = repository()
    vi.mocked(repo.applyBatch).mockRejectedValue(new WebsiteIndexInUseError())
    await expect(saveAdminWebsiteIndexes({ upserts: [], deleteIds: ['2'] }, repo)).rejects.toMatchObject({ statusCode: 409, data: { reason: 'source_in_use' } })
  })
  it.each([null, [' '], ['<b>tag</b>'], [null], 'tag'].map(tags => [tags]))('rejects malformed feature tags %j before writes', async tags => {
    const repo = repository()
    await expect(saveAdminWebsiteIndexes({ upserts: [{ name: 'New', indexUrl: 'https://new.example', active: true, notes: null, tags }], deleteIds: [] }, repo)).rejects.toMatchObject({ statusCode: 400 })
    expect(repo.applyBatch).not.toHaveBeenCalled()
  })
  it('normalizes a mixed batch and leaves new IDs for bigserial', async () => {
    const repo = repository()
    await saveAdminWebsiteIndexes({
      upserts: [
        { id: '2', expectedActive: true, name: '  Alpha updated  ', indexUrl: ' https://alpha.example/new ', active: false, notes: '  New note  ', tags: [] },
        { name: 'New index', indexUrl: 'https://new.example/consultations', active: true, notes: '   ', tags: [] }
      ],
      deleteIds: ['7']
    }, repo)

    expect(repo.applyBatch).toHaveBeenCalledWith([
      { id: 2n, expectedActive: true, name: 'Alpha updated', indexUrl: 'https://alpha.example/new', active: false, notes: 'New note', tags: [] },
      { name: 'New index', indexUrl: 'https://new.example/consultations', active: true, notes: null, tags: [] }
    ], [7n])
    expect(vi.mocked(repo.applyBatch).mock.calls[0]![0][1]).not.toHaveProperty('id')
  })

  it.each([
    [{ upserts: [], deleteIds: [], extra: true }, 'upserts and deleteIds'],
    [{ upserts: [{ name: '', indexUrl: 'https://example.com', active: true, notes: null, tags: [] }], deleteIds: [] }, 'name'],
    [{ upserts: [{ name: 'Name', indexUrl: 'http://example.com', active: true, notes: null, tags: [] }], deleteIds: [] }, 'HTTPS'],
    [{ upserts: [{ name: 'Name', indexUrl: 'https://example.com', active: 'yes', notes: null, tags: [] }], deleteIds: [] }, 'Active'],
    [{ upserts: [{ id: '0', name: 'Name', indexUrl: 'https://example.com', active: true, notes: null, tags: [] }], deleteIds: [] }, 'positive'],
    [{ upserts: [{ id: '2', expectedActive: true, name: 'Name', indexUrl: 'https://example.com', active: true, notes: null, tags: [] }], deleteIds: ['2'] }, 'updated and deleted'],
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

describe('website index active concurrency validation', () => {
  it('requires the loaded active flag when updating existing records', async () => {
    const repo = repository()
    await expect(saveAdminWebsiteIndexes({ upserts: [
      { id: '2', name: 'Alpha', indexUrl: 'https://alpha.example', active: false, notes: null, tags: [] }
    ], deleteIds: [] }, repo)).rejects.toMatchObject({ statusCode: 400 })
    expect(repo.applyBatch).not.toHaveBeenCalled()
  })
})
