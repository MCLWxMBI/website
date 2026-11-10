import { beforeEach, describe, expect, it, vi } from 'vitest'
const requireAdmin = vi.hoisted(() => vi.fn())
const repo = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn() }))
const getQuery = vi.hoisted(() => vi.fn())
const getRouterParam = vi.hoisted(() => vi.fn())
vi.mock('../../server/utils/require-admin', () => ({ requireAdmin }))
vi.mock('../../server/utils/admin-scraper-runs-repository', () => ({ scraperRunsRepository: repo }))
vi.mock('h3', async original => ({ ...await original<typeof import('h3')>(), getQuery, getRouterParam }))
import list from '../../server/api/admin/scraper/runs/index.get'
import detail from '../../server/api/admin/scraper/runs/[id].get'
const event = {} as Parameters<typeof list>[0]
beforeEach(() => {
  requireAdmin.mockReset().mockResolvedValue({})
  repo.list.mockResolvedValue({ rows: [], total: 0, page: 1 }); repo.detail.mockResolvedValue(null)
  getQuery.mockReturnValue({}); getRouterParam.mockReturnValue('1')
})
describe('protected scraper run handlers', () => {
  it('authenticates before reading request parameters or storage', async () => {
    await list(event); await expect(detail(event)).rejects.toMatchObject({ statusCode: 404 })
    expect(requireAdmin.mock.invocationCallOrder[0]).toBeLessThan(getQuery.mock.invocationCallOrder[0]!)
    expect(requireAdmin.mock.invocationCallOrder[1]).toBeLessThan(getRouterParam.mock.invocationCallOrder[0]!)
  })
  it.each([401, 403, 503])('does not query log storage after an authorization failure (%i)', async statusCode => {
    requireAdmin.mockRejectedValue({ statusCode })
    await expect(list(event)).rejects.toMatchObject({ statusCode })
    await expect(detail(event)).rejects.toMatchObject({ statusCode })
    expect(repo.list).not.toHaveBeenCalled(); expect(repo.detail).not.toHaveBeenCalled()
    expect(getQuery).not.toHaveBeenCalled(); expect(getRouterParam).not.toHaveBeenCalled()
  })
})
