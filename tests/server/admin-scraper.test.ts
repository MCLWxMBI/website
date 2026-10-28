import { describe, expect, it, vi } from 'vitest'
import { parseScraperQuery, readAdminScraperArticles, readAdminScraperSources, type AdminScraperRepository } from '../../server/services/admin-scraper'

const repository = (): AdminScraperRepository => ({
  updateSources: vi.fn().mockResolvedValue({ sources: [], unassignedCount: 0 }),
  sources: vi.fn().mockResolvedValue({ sources: [], unassignedCount: 0 }),
  articles: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 })
})
describe('admin scraper queries', () => {
  it('accepts bigint source IDs, unassigned articles, and normalized searches', () => {
    expect(parseScraperQuery({ source: '9223372036854775807', q: ' Water ', page: '3' }))
      .toEqual({ sourceId: 9223372036854775807n, q: 'Water', page: 3 })
    expect(parseScraperQuery({ source: 'unassigned' })).toEqual({ sourceId: null, q: '', page: 1 })
  })
  it.each([
    {}, { source: '0' }, { source: '-1' }, { source: '1.5' }, { source: '9223372036854775808' },
    { source: ['1', '2'] }, { source: '1', page: '0' }, { source: '1', page: '1.1' },
    { source: '1', page: '9007199254740992' }, { source: '1', page: ['1'] },
    { source: '1', q: ['title'] }, { source: '1', q: 'a'.repeat(201) }
  ])('rejects invalid input before querying: %j', async query => {
    const repo = repository()
    await expect(readAdminScraperArticles(query, repo)).rejects.toMatchObject({ statusCode: 400 })
    expect(repo.articles).not.toHaveBeenCalled()
  })
  it('distinguishes empty sources from missing sources', async () => {
    const repo = repository()
    await expect(readAdminScraperArticles({ source: '1' }, repo)).resolves.toMatchObject({ items: [], total: 0 })
    vi.mocked(repo.articles).mockResolvedValue(null)
    await expect(readAdminScraperArticles({ source: '2' }, repo)).rejects.toMatchObject({ statusCode: 404 })
  })
  it('returns generic database failures for both reads', async () => {
    const repo = repository()
    vi.mocked(repo.articles).mockRejectedValue(new Error('private DB credentials'))
    vi.mocked(repo.sources).mockRejectedValue(new Error('private DB credentials'))
    for (const promise of [readAdminScraperSources(repo), readAdminScraperArticles({ source: '1' }, repo)]) {
      await expect(promise).rejects.toMatchObject({ statusCode: 503, statusMessage: expect.not.stringContaining('credentials') })
    }
  })
})

describe('source setting saves', () => {
  it('normalizes source IDs and forwards only active settings', async () => {
    const repo = repository()
    const { saveAdminScraperSources } = await import('../../server/services/admin-scraper')
    await saveAdminScraperSources({ updates: [{ id: '2', active: false, expectedActive: true }] }, repo)
    expect(repo.updateSources).toHaveBeenCalledWith([{ id: 2n, active: false, expectedActive: true }])
  })
  it.each([
    null, [], {}, { updates: 'all' }, { updates: [], extra: true },
    { updates: [{ id: '0', active: true, expectedActive: false }] },
    { updates: [{ id: '9223372036854775808', active: true, expectedActive: false }] },
    { updates: [{ id: '1', active: 'yes', expectedActive: false }] },
    { updates: [{ id: '1', active: true }] },
    { updates: [{ id: '1', active: true, expectedActive: null }] },
    { updates: [{ id: '1', active: true, expectedActive: false, name: 'Overwrite' }] },
    { updates: [{ id: '1', active: true, expectedActive: false }, { id: '1', active: false, expectedActive: false }] }
  ])('rejects invalid saves before writing: %j', async body => {
    const repo = repository()
    const { saveAdminScraperSources } = await import('../../server/services/admin-scraper')
    await expect(saveAdminScraperSources(body, repo)).rejects.toMatchObject({ statusCode: 400 })
    expect(repo.updateSources).not.toHaveBeenCalled()
  })
  it('distinguishes conflicts from database failures without exposing details', async () => {
    const repo = repository()
    const { saveAdminScraperSources, ScraperSourceConflictError } = await import('../../server/services/admin-scraper')
    vi.mocked(repo.updateSources).mockRejectedValueOnce(new ScraperSourceConflictError())
      .mockRejectedValueOnce(new Error('private DB credentials'))
    await expect(saveAdminScraperSources({ updates: [] }, repo)).rejects.toMatchObject({ statusCode: 409 })
    await expect(saveAdminScraperSources({ updates: [] }, repo)).rejects.toMatchObject({ statusCode: 503,
      statusMessage: expect.not.stringContaining('credentials') })
  })
})
