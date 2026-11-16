import { describe, expect, it, vi } from 'vitest'
import { deleteAdminOpportunity, listAdminOpportunities, OpportunityManagementConflict, OpportunityManagementNotFound,
  readAdminOpportunity, updateAdminOpportunity, type AdminOpportunityManagementRepository } from '../../server/services/admin-opportunity-management'
import { validateUpdateOpportunity } from '../../shared/utils/admin-opportunity-management'
import { buildCreateOpportunity, draftFromOpportunity } from '../../app/utils/opportunity-create-state'
import { makeOpportunity } from '../support/opportunity'

const version = 'a'.repeat(64)
const content = { title: 'Edited listing', fullText: ['Edited text.'], jurisdiction: 'Victoria', startDate: null,
  submissionDeadline: '2027-11', category: ['Climate change'], expectedVersion: version }
function repository(): AdminOpportunityManagementRepository {
  return { list: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 }),
    detail: vi.fn().mockResolvedValue(null), update: vi.fn(), delete: vi.fn() }
}
describe('opportunity management validation and services', () => {
  it('accepts month deadlines and distinguishes retained and explicitly removed locations', () => {
    expect(validateUpdateOpportunity(content)).not.toHaveProperty('location')
    expect(validateUpdateOpportunity({ ...content, location: null, summary: '' })).toMatchObject({ location: null })
    expect(validateUpdateOpportunity({ ...content, location: { label: 'Place', geometry: { type: 'Point', coordinates: [145, -38] } } }).location?.label).toBe('Place')
  })
  it.each([{ sourceUrl: 'https://changed.gov.au' }, { organisation: { existingId: '2' } }, { tags: ['Invite-only'] }, { id: 'changed' },
    { expectedVersion: 'bad' }, { submissionDeadline: '2027-13' }, { startDate: '2027-11-02T00:00:00Z' },
    { title: '' }, { category: [] }, { location: { label: 'Bad', geometry: { type: 'Point', coordinates: [200, 0] } } }])('rejects invalid or immutable fields: %j', async patch => {
    const repo = repository()
    await expect(updateAdminOpportunity('one', { ...content, ...patch }, repo)).rejects.toMatchObject({ statusCode: 400 })
    expect(repo.update).not.toHaveBeenCalled()
  })
  it('validates deletion bodies and forwards only a valid fingerprint', async () => {
    const repo = repository()
    for (const body of [null, [], {}, { expectedVersion: 'bad' }, { expectedVersion: version, deleted: true }]) {
      await expect(deleteAdminOpportunity('one', body, repo)).rejects.toMatchObject({ statusCode: 400 })
    }
    expect(repo.delete).not.toHaveBeenCalled()
    await expect(deleteAdminOpportunity('one', { expectedVersion: version }, repo)).resolves.toEqual({ deleted: true })
    expect(repo.delete).toHaveBeenCalledWith('one', version)
  })
  it('defaults to published listings and validates all collection filters', async () => {
    const repo = repository()
    await listAdminOpportunities({}, repo)
    expect(repo.list).toHaveBeenCalledWith({ q: '', source: null, status: 'all', deleted: false, page: 1 })
    await listAdminOpportunities({ q: ' title ', source: '2', status: 'upcoming', deleted: 'true', page: '2' }, repo)
    expect(repo.list).toHaveBeenLastCalledWith({ q: 'title', source: 2n, status: 'upcoming', deleted: true, page: 2 })
    for (const query of [{ q: ['title'] }, { q: 'x'.repeat(201) }, { source: '-1' }, { source: '999999999999999999999' },
      { status: ['open'] }, { status: 'deleted' }, { deleted: true }, { page: '0' }, { page: '99999999999999999999' }]) {
      await expect(listAdminOpportunities(query, repo)).rejects.toMatchObject({ statusCode: 400 })
    }
  })
  it('distinguishes missing records, conflicts, and generic database failures', async () => {
    const repo = repository()
    await expect(readAdminOpportunity('missing', repo)).rejects.toMatchObject({ statusCode: 404 })
    vi.mocked(repo.update).mockRejectedValue(new OpportunityManagementConflict())
    await expect(updateAdminOpportunity('one', content, repo)).rejects.toMatchObject({ statusCode: 409 })
    vi.mocked(repo.delete).mockRejectedValue(new OpportunityManagementNotFound())
    await expect(deleteAdminOpportunity('missing', { expectedVersion: version }, repo)).rejects.toMatchObject({ statusCode: 404 })
    for (const method of ['list', 'detail', 'update', 'delete'] as const) vi.mocked(repo[method]).mockRejectedValue(new Error('private database password'))
    for (const promise of [listAdminOpportunities({}, repo), readAdminOpportunity('one', repo), updateAdminOpportunity('one', content, repo), deleteAdminOpportunity('one', { expectedVersion: version }, repo)]) {
      await expect(promise).rejects.toMatchObject({ statusCode: 503, statusMessage: expect.not.stringContaining('password') })
    }
  })
})

describe('editing draft population', () => {
  it('round-trips UTC timestamps, month precision, paragraphs, and map points without mutating the original', () => {
    const opportunity = makeOpportunity({ website: '1', submissionDeadline: '2027-11', startDate: '2027-09-01T12:34:56.789Z',
      location: { label: 'Point', geometry: { type: 'Point', coordinates: [145, -38] } } })
    const before = structuredClone(opportunity)
    const draft = draftFromOpportunity(opportunity)
    const request = buildCreateOpportunity(draft)
    expect(request).toMatchObject({ title: opportunity.title, startDate: opportunity.startDate, submissionDeadline: '2027-11', location: opportunity.location })
    draft.paragraphs[0]!.text = 'Changed'
    draft.categories.push('Water & resources')
    expect(opportunity).toEqual(before)
    expect(buildCreateOpportunity(draftFromOpportunity(makeOpportunity({ website: '1' })))).toHaveProperty('submissionDeadline', '2026-11-06T17:00:00.000Z')
  })
  it('does not accidentally turn a boundary into a map pin', () => {
    const draft = draftFromOpportunity(makeOpportunity({ location: { label: 'Area', geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] } } }))
    expect(draft.locationEnabled).toBe(false)
  })
})
