import { describe, expect, it } from 'vitest'
import { validateCreateOpportunity } from '../../shared/utils/admin-opportunity'
import { buildCreateOpportunity, newOpportunityDraft } from '../../app/utils/opportunity-create-state'
import { makeCreateOpportunity } from '../support/admin-opportunity'

describe('manual opportunity validation', () => {
  it('normalizes text, canonical URLs, duplicate labels, and the controlled Invite-only tag', () => {
    const result = validateCreateOpportunity(makeCreateOpportunity({ title: ' Title ', fullText: [' First ', 'Second'],
      sourceUrl: 'https://EXAMPLE.gov.au:443/consultation?q=1#section', category: ['Climate change', 'Climate change'],
      tags: [' Science ', 'science', 'invite-only', 'Invite-only'], summary: ' ' }))
    expect(result).toMatchObject({ title: 'Title', fullText: ['First', 'Second'], sourceUrl: 'https://example.gov.au/consultation?q=1',
      category: ['Climate change'], tags: ['Science', 'Invite-only'], startDate: null })
    expect(result).not.toHaveProperty('summary')
  })
  it('allows a new source, trims its name and URL, and retains month precision', () => {
    expect(validateCreateOpportunity(makeCreateOpportunity({ organisation: { newSource: { name: ' New authority ', indexUrl: ' https://example.gov.au/consultations ' } },
      submissionDeadline: '2027-11', startDate: '2027-10-01T12:00:00Z', tags: [] })))
      .toMatchObject({ organisation: { newSource: { name: 'New authority', indexUrl: 'https://example.gov.au/consultations' } }, tags: null, submissionDeadline: '2027-11' })
  })
  it.each([
    { existingId: '' }, { existingId: '0' }, { existingId: '-1' }, { existingId: '1.5' }, { existingId: 1 },
    { existingId: '9223372036854775808' }, { existingId: '1', newSource: { name: 'New', indexUrl: 'https://example.gov.au' } },
    { newSource: { name: '', indexUrl: 'https://example.gov.au' } },
    { newSource: { name: 'a'.repeat(256), indexUrl: 'https://example.gov.au' } },
    { newSource: { name: 'Authority', indexUrl: 'http://example.gov.au' } },
    { newSource: { name: 'Authority', indexUrl: 'not a URL' } },
    { newSource: { name: 'Authority', indexUrl: 'https://example.gov.au', active: true } }
  ])('rejects invalid organisation selections %j', organisation => {
    expect(() => validateCreateOpportunity({ ...makeCreateOpportunity(), organisation })).toThrow()
  })
  it.each([
    ['title', ''], ['title', '<b>HTML</b>'], ['fullText', []], ['fullText', ['']], ['fullText', ['<script>alert(1)</script>']],
    ['sourceUrl', 'http://example.gov.au'], ['sourceUrl', 'https://user:password@example.gov.au'], ['sourceUrl', 'not a URL'],
    ['jurisdiction', 'Unknown'], ['category', []], ['category', ['Unknown']],
    ['tags', [' ']], ['tags', ['<b>tag</b>']], ['tags', [null]], ['tags', 'a tag'],
    ['submissionDeadline', '2027-13'], ['submissionDeadline', '0000-01'], ['submissionDeadline', '10000-01'],
    ['submissionDeadline', '2027-02-30T12:00:00Z'], ['submissionDeadline', '2027-01-01T12:00:00+10:00'],
    ['startDate', '2027-11'], ['startDate', '2028-01-01T00:00:00Z'],
    ['summary', Array.from({ length: 36 }, () => 'word').join(' ')],
    ['organisation', null]
  ])('rejects invalid %s: %j', (field, value) => {
    expect(() => validateCreateOpportunity({ ...makeCreateOpportunity(), [field]: value })).toThrow()
  })
  it('rejects writable storage-only fields', () => {
    for (const field of ['id', 'hash', 'deleted', 'status', 'submissionDeadlinePrecision', 'website', 'sourceOrg']) {
      expect(() => validateCreateOpportunity({ ...makeCreateOpportunity(), [field]: 'injected' })).toThrow('Unsupported')
    }
  })
  it('enforces the first-day deadline comparison for month-only values', () => {
    expect(() => validateCreateOpportunity(makeCreateOpportunity({ submissionDeadline: '2027-11', startDate: '2027-11-01T00:00:00Z' }))).not.toThrow()
    expect(() => validateCreateOpportunity(makeCreateOpportunity({ submissionDeadline: '2027-11', startDate: '2027-11-01T00:00:01Z' }))).toThrow('Opening')
  })
  it('accepts bounded points in longitude/latitude order, including zero', () => {
    for (const coordinates of [[0, 0], [-180, -90], [180, 90]]) {
      expect(validateCreateOpportunity({ ...makeCreateOpportunity(), location: { label: 'Place', geometry: { type: 'Point', coordinates } } }).location?.geometry.coordinates).toEqual(coordinates)
    }
  })
  it.each([[181, 0], [0, 91], [NaN, 0], [0, Infinity], ['1', 1], [1, 2, 3]])('rejects invalid coordinates %j', (...coordinates) => {
    expect(() => validateCreateOpportunity({ ...makeCreateOpportunity(), location: { label: 'Place', geometry: { type: 'Point', coordinates } } })).toThrow()
  })
  it('does not accept polygon authoring in the initial admin endpoint', () => {
    expect(() => validateCreateOpportunity({ ...makeCreateOpportunity(), location: { label: 'Area', geometry: { type: 'Polygon', coordinates: [] } } })).toThrow('longitude')
  })
})

function filledDraft() {
  return { ...newOpportunityDraft(), title: 'Manual consultation', sourceUrl: 'https://example.gov.au/manual', sourceOrg: 'Authority',
    jurisdiction: 'Victoria' as const, sourceIndexId: '1', paragraphs: [{ key: 1, text: 'First paragraph.' }],
    categories: ['Climate change' as const], deadlineDateTime: '2027-11-06T17:00' }
}
describe('creation form payloads', () => {
  it('submits an existing source ID without trusting its displayed organisation name', () => {
    expect(buildCreateOpportunity(filledDraft()).organisation).toEqual({ existingId: '1' })
    expect(buildCreateOpportunity(filledDraft())).not.toHaveProperty('sourceOrg')
  })
  it('requires the index URL when the organisation is free text', () => {
    const draft = { ...filledDraft(), sourceIndexId: '' }
    expect(() => buildCreateOpportunity(draft)).toThrow()
    expect(buildCreateOpportunity({ ...draft, newSourceIndexUrl: 'https://example.gov.au/consultations' }).organisation)
      .toEqual({ newSource: { name: 'Authority', indexUrl: 'https://example.gov.au/consultations' } })
  })
  it('converts explicitly UTC date inputs without applying the browser timezone', () => {
    expect(buildCreateOpportunity({ ...filledDraft(), startDate: '2027-10-01T12:30' })).toMatchObject({
      startDate: '2027-10-01T12:30:00.000Z', submissionDeadline: '2027-11-06T17:00:00.000Z'
    })
  })
  it('keeps month-only precision and paragraph order', () => {
    expect(buildCreateOpportunity({ ...filledDraft(), deadlineMode: 'month', deadlineMonth: '2027-11',
      paragraphs: [{ key: 2, text: 'Second first.' }, { key: 1, text: 'First second.' }] }))
      .toMatchObject({ submissionDeadline: '2027-11', fullText: ['Second first.', 'First second.'] })
  })
  it('keeps Invite-only controlled independently of free-form tags', () => {
    expect(buildCreateOpportunity({ ...filledDraft(), tags: ['invite-only', 'Science'], inviteOnly: false }).tags).toEqual(['Science'])
    expect(buildCreateOpportunity({ ...filledDraft(), tags: ['SCIENCE', 'science'], inviteOnly: true }).tags).toEqual(['SCIENCE', 'Invite-only'])
  })
  it('handles browser number-input values and requires both coordinates', () => {
    expect(buildCreateOpportunity({ ...filledDraft(), locationEnabled: true, locationLabel: 'Place', latitude: 0, longitude: 0 }).location?.geometry.coordinates).toEqual([0, 0])
    expect(() => buildCreateOpportunity({ ...filledDraft(), locationEnabled: true, locationLabel: 'Place', latitude: '', longitude: '0' })).toThrow('both')
  })
  it('rejects invalid calendar inputs instead of rolling them into another month', () => {
    expect(() => buildCreateOpportunity({ ...filledDraft(), deadlineDateTime: '2027-02-30T17:00' })).toThrow('valid UTC')
  })
})
