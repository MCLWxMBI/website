import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeCreateOpportunity } from '../support/admin-opportunity'
const repo = vi.hoisted(() => ({ options: vi.fn(), create: vi.fn() }))
const requireAdmin = vi.hoisted(() => vi.fn())
const readBody = vi.hoisted(() => vi.fn())
const setResponseStatus = vi.hoisted(() => vi.fn())
vi.mock('../../server/utils/admin-opportunity-repository', () => ({ adminOpportunityRepository: repo }))
vi.mock('../../server/utils/require-admin', () => ({ requireAdmin }))
vi.mock('h3', async original => ({ ...await original<typeof import('h3')>(), readBody, setResponseStatus }))
import options from '../../server/api/admin/opportunities/options.get'
import publish from '../../server/api/admin/opportunities/index.post'
const event = {} as Parameters<typeof options>[0]
beforeEach(() => {
  requireAdmin.mockReset().mockResolvedValue({})
  readBody.mockResolvedValue(makeCreateOpportunity())
  repo.options.mockResolvedValue({ sources: [] })
  repo.create.mockImplementation(async (input, id) => ({ opportunity: { ...input, sourceOrg: 'Test authority', id, websiteId: 'existing-platform', startDate: null,
    submissionDeadline: new Date(input.submissionDeadline), submissionDeadlinePrecision: 'datetime', summary: null, location: null }, websiteTags: [] }))
})
describe('protected opportunity creation handlers', () => {
  it('authorizes reads and writes before accessing body or storage, and returns 201', async () => {
    await options(event)
    await publish(event)
    expect(requireAdmin.mock.invocationCallOrder[0]).toBeLessThan(repo.options.mock.invocationCallOrder[0]!)
    expect(requireAdmin.mock.invocationCallOrder[1]).toBeLessThan(readBody.mock.invocationCallOrder[0]!)
    expect(setResponseStatus).toHaveBeenCalledWith(event, 201)
  })
  it.each([401, 403])('does not read a body or write when authorization fails (%i)', async statusCode => {
    requireAdmin.mockRejectedValue({ statusCode })
    await expect(options(event)).rejects.toMatchObject({ statusCode })
    await expect(publish(event)).rejects.toMatchObject({ statusCode })
    expect(readBody).not.toHaveBeenCalled()
    expect(repo.create).not.toHaveBeenCalled()
    expect(repo.options).not.toHaveBeenCalled()
  })
})
