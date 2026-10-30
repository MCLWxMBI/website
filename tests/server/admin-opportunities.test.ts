import { describe, expect, it, vi } from 'vitest'
import { OpportunityCreateConflict, publishAdminOpportunity, readAdminOpportunityOptions, type AdminOpportunityRepository } from '../../server/services/admin-opportunities'
import { makeCreateOpportunity } from '../support/admin-opportunity'

function repository(): AdminOpportunityRepository {
  return { options: vi.fn().mockResolvedValue({ sources: [] }), create: vi.fn().mockImplementation(async (input, id) => ({
    opportunity: { ...input, sourceOrg: 'Test authority', id, websiteId: 'existing-platform', startDate: null, submissionDeadline: new Date('2027-11-01T00:00:00Z'),
      submissionDeadlinePrecision: 'month', summary: null, location: null }, websiteTags: ['Online submission']
  })) }
}
describe('admin opportunity services', () => {
  it('provides empty source suggestions without fabricating records', async () => {
    await expect(readAdminOpportunityOptions(repository())).resolves.toEqual({ sources: [] })
  })
  it('validates before opening a write and returns field errors', async () => {
    const repo = repository()
    await expect(publishAdminOpportunity(makeCreateOpportunity({ title: '' }), repo)).rejects.toMatchObject({ statusCode: 400, data: { fieldErrors: { title: expect.any(String) } } })
    expect(repo.create).not.toHaveBeenCalled()
  })
  it('generates a stable URL-safe identifier and reuses the public serialization contract', async () => {
    const repo = repository()
    const result = await publishAdminOpportunity(makeCreateOpportunity({ submissionDeadline: '2027-11' }), repo)
    expect(result.opportunity.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(result).toMatchObject({ opportunity: { submissionDeadline: '2027-11', website: 'existing-platform' }, websiteTags: ['Online submission'] })
    expect(result.opportunity).not.toHaveProperty('hash')
    expect(result.opportunity).not.toHaveProperty('submissionDeadlinePrecision')
  })
  it('distinguishes known conflicts and exposes the existing listing link', async () => {
    const repo = repository()
    vi.mocked(repo.create).mockRejectedValue(new OpportunityCreateConflict('URL already exists.', 'existing-id'))
    await expect(publishAdminOpportunity(makeCreateOpportunity(), repo)).rejects.toMatchObject({ statusCode: 409, data: { opportunityId: 'existing-id' } })
  })
  it('does not expose configuration or database failures on either route', async () => {
    const repo = repository()
    vi.mocked(repo.create).mockRejectedValue(new Error('postgresql://user:secret@host/db'))
    vi.mocked(repo.options).mockRejectedValue(new Error('private configuration'))
    for (const promise of [readAdminOpportunityOptions(repo), publishAdminOpportunity(makeCreateOpportunity(), repo)]) {
      await expect(promise).rejects.toMatchObject({ statusCode: 503, statusMessage: expect.not.stringContaining('secret') })
    }
  })
})
