import { beforeEach, describe, expect, it, vi } from 'vitest'
const repository = vi.hoisted(() => ({ sources: vi.fn(), articles: vi.fn() }))
const requireAdmin = vi.hoisted(() => vi.fn())
const getQuery = vi.hoisted(() => vi.fn())
vi.mock('../../server/utils/admin-scraper-repository', () => ({ adminScraperRepository: repository }))
vi.mock('../../server/utils/require-admin', () => ({ requireAdmin }))
vi.mock('h3', async original => ({ ...await original<typeof import('h3')>(), getQuery }))
import sources from '../../server/api/admin/scraper/sources.get'
import articles from '../../server/api/admin/scraper/articles.get'
const event = {} as Parameters<typeof sources>[0]
beforeEach(() => {
  requireAdmin.mockReset().mockResolvedValue({})
  repository.sources.mockReset().mockResolvedValue({ sources: [], unassignedCount: 0 })
  repository.articles.mockReset().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 })
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
