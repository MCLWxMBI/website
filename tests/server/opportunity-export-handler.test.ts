import { beforeEach, describe, expect, it, vi } from 'vitest'
const requireAdmin = vi.hoisted(() => vi.fn())
const repository = vi.hoisted(() => ({ allForExport: vi.fn() }))
const setResponseHeader = vi.hoisted(() => vi.fn())
vi.mock('../../server/utils/require-admin', () => ({ requireAdmin }))
vi.mock('../../server/utils/opportunity-repository', () => ({ opportunityExportRepository: repository }))
vi.mock('h3', async original => ({ ...await original<typeof import('h3')>(), setResponseHeader }))
import handler from '../../server/api/admin/opportunities/export.get'
const event = {} as Parameters<typeof handler>[0]
beforeEach(() => {
  requireAdmin.mockReset().mockResolvedValue({})
  repository.allForExport.mockReset().mockResolvedValue([])
})
describe('admin opportunity export endpoint', () => {
  it('authorizes before reading records, then returns a binary attachment', async () => {
    const result = await handler(event)
    expect(requireAdmin.mock.invocationCallOrder[0]).toBeLessThan(repository.allForExport.mock.invocationCallOrder[0]!)
    expect(Buffer.isBuffer(result)).toBe(true)
    expect(setResponseHeader).toHaveBeenCalledWith(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    expect(setResponseHeader).toHaveBeenCalledWith(event, 'Content-Disposition', expect.stringMatching(/^attachment; filename="echo-opportunities-\d{4}-\d{2}-\d{2}\.xlsx"$/))
  })
  it.each([401, 403, 503])('does no export work when authorization fails (%i)', async statusCode => {
    requireAdmin.mockRejectedValue({ statusCode })
    await expect(handler(event)).rejects.toMatchObject({ statusCode })
    expect(repository.allForExport).not.toHaveBeenCalled()
    expect(setResponseHeader).not.toHaveBeenCalled()
  })
  it('returns a generic database failure without attachment headers', async () => {
    repository.allForExport.mockRejectedValue(new Error('private SQL information'))
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 503 })
    expect(setResponseHeader).not.toHaveBeenCalled()
  })
})
