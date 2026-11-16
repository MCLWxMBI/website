import { beforeEach, describe, expect, it, vi } from 'vitest'
const repository = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn(), update: vi.fn(), delete: vi.fn() }))
const requireAdmin = vi.hoisted(() => vi.fn())
const readBody = vi.hoisted(() => vi.fn())
const getQuery = vi.hoisted(() => vi.fn())
const getRouterParam = vi.hoisted(() => vi.fn())
vi.mock('../../server/utils/admin-opportunity-management-repository', () => ({ adminOpportunityManagementRepository: repository }))
vi.mock('../../server/utils/require-admin', () => ({ requireAdmin }))
vi.mock('h3', async original => ({ ...await original<typeof import('h3')>(), readBody, getQuery, getRouterParam }))
import list from '../../server/api/admin/opportunities/index.get'
import detail from '../../server/api/admin/opportunities/[id].get'
import update from '../../server/api/admin/opportunities/[id].patch'
import remove from '../../server/api/admin/opportunities/[id].delete'
const event = {} as Parameters<typeof list>[0]
beforeEach(() => {
  requireAdmin.mockReset().mockResolvedValue({})
  getQuery.mockReturnValue({})
  getRouterParam.mockReturnValue('one')
  repository.detail.mockResolvedValue({ deleted: false })
  readBody.mockResolvedValue({ expectedVersion: 'a'.repeat(64), title: 'Title', fullText: ['Text'], jurisdiction: 'Victoria',
    category: ['Climate change'], startDate: null, submissionDeadline: '2027-11' })
})
describe('protected opportunity management endpoints', () => {
  it('authorizes all handlers before accessing query, body, or storage', async () => {
    await list(event); await detail(event); await update(event)
    readBody.mockResolvedValue({ expectedVersion: 'a'.repeat(64) })
    await remove(event)
    expect(requireAdmin).toHaveBeenCalledTimes(4)
    expect(requireAdmin.mock.invocationCallOrder[0]).toBeLessThan(getQuery.mock.invocationCallOrder[0]!)
    expect(requireAdmin.mock.invocationCallOrder[1]).toBeLessThan(repository.detail.mock.invocationCallOrder[0]!)
    expect(requireAdmin.mock.invocationCallOrder[2]).toBeLessThan(readBody.mock.invocationCallOrder[0]!)
    expect(requireAdmin.mock.invocationCallOrder[3]).toBeLessThan(readBody.mock.invocationCallOrder[1]!)
  })
  it.each([401, 403])('does no management work when authorization fails (%i)', async statusCode => {
    requireAdmin.mockRejectedValue({ statusCode })
    for (const handler of [list, detail, update, remove]) await expect(handler(event)).rejects.toMatchObject({ statusCode })
    for (const spy of [readBody, getQuery, getRouterParam, ...Object.values(repository)]) expect(spy).not.toHaveBeenCalled()
  })
})
