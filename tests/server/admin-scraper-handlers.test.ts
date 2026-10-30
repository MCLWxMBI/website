import { beforeEach, describe, expect, it, vi } from 'vitest'
const repository = vi.hoisted(() => ({ sources: vi.fn(), articles: vi.fn(), updateSources: vi.fn() }))
const requireAdmin = vi.hoisted(() => vi.fn())
const readBody = vi.hoisted(() => vi.fn())
const getQuery = vi.hoisted(() => vi.fn())
vi.mock('../../server/utils/admin-scraper-repository', () => ({ adminScraperRepository: repository }))
vi.mock('../../server/utils/require-admin', () => ({ requireAdmin }))
vi.mock('h3', async original => ({ ...await original<typeof import('h3')>(), getQuery, readBody }))
import sources from '../../server/api/admin/scraper/sources.get'
import articles from '../../server/api/admin/scraper/articles.get'
import saveSources from '../../server/api/admin/scraper/sources.patch'
const event = {} as Parameters<typeof sources>[0]
beforeEach(() => {
  requireAdmin.mockReset().mockResolvedValue({})
  repository.sources.mockReset().mockResolvedValue({ sources: [], unassignedCount: 0 })
  repository.articles.mockReset().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 })
  readBody.mockResolvedValue({ updates: [{ id: '1', active: false, expectedActive: true }] })
  repository.updateSources.mockReset().mockResolvedValue({ sources: [], unassignedCount: 0 })
  getQuery.mockReturnValue({ source: 'unassigned' })
})
describe('protected scraper handlers', () => {
  it('authorizes both endpoints before querying', async () => {
    await sources(event)
    await articles(event)
    expect(requireAdmin).toHaveBeenCalledTimes(2)
    expect(requireAdmin.mock.invocationCallOrder[0]).toBeLessThan(repository.sources.mock.invocationCallOrder[0]!)
    expect(requireAdmin.mock.invocationCallOrder[1]).toBeLessThan(getQuery.mock.invocationCallOrder[0]!)
    expect(repository.articles).toHaveBeenCalledWith({ sourceId: null, q: '', page: 1 })
  })
  it.each([401, 403])('does not read articles or sources when authorization fails (%i)', async statusCode => {
    requireAdmin.mockRejectedValue({ statusCode })
    await expect(sources(event)).rejects.toMatchObject({ statusCode })
    await expect(articles(event)).rejects.toMatchObject({ statusCode })
    expect(repository.sources).not.toHaveBeenCalled()
    expect(repository.articles).not.toHaveBeenCalled()
  })
})

describe('protected source setting handler', () => {
  it('authorizes before reading the body and saving', async () => {
    await saveSources(event)
    expect(requireAdmin.mock.invocationCallOrder[0]).toBeLessThan(readBody.mock.invocationCallOrder[0]!)
    expect(repository.updateSources).toHaveBeenCalledWith([{ id: 1n, active: false, expectedActive: true }])
  })
  it.each([401, 403])('does not read a body or save for an unauthorized request (%i)', async statusCode => {
    requireAdmin.mockRejectedValue({ statusCode })
    await expect(saveSources(event)).rejects.toMatchObject({ statusCode })
    expect(readBody).not.toHaveBeenCalled()
    expect(repository.updateSources).not.toHaveBeenCalled()
  })
})
