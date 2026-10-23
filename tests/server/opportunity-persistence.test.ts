import { describe, expect, it } from 'vitest'
import type { OpportunityRecord } from '../../server/database/schema'
import { serializeOpportunity } from '../../server/services/opportunities'
import { toOpportunity } from '../../shared/utils/opportunity'

const row: OpportunityRecord = {
  id: 'consultation',
  title: 'Consultation title',
  fullText: ['A paragraph of consultation text.'],
  sourceUrl: 'https://example.gov.au/consultation',
  websiteId: 'another-platform',
  sourceOrg: 'Publishing organisation',
  jurisdiction: 'Victoria',
  startDate: null,
  submissionDeadline: new Date('2026-10-23T17:00:00+11:00'),
  category: ['Climate change'],
  tags: null,
  summary: null,
  location: null
}

describe('opportunity persistence boundary', () => {
  it('maps persisted fields and omits null optional fields and stored-only details', () => {
    const response = serializeOpportunity(row)
    expect(response).toEqual({
      id: row.id, title: row.title, fullText: row.fullText, sourceUrl: row.sourceUrl,
      website: row.websiteId, sourceOrg: row.sourceOrg, jurisdiction: row.jurisdiction,
      startDate: null, submissionDeadline: '2026-10-23T06:00:00.000Z',
      category: row.category, tags: null
    })
    expect(response).not.toHaveProperty('status')
    expect(response).not.toHaveProperty('websiteId')
  })

  it('serializes opening times, summaries, tags and geographic data when supplied', () => {
    const location = { label: 'Melbourne', geometry: { type: 'Point' as const, coordinates: [144.9, -37.8] as [number, number] } }
    const response = serializeOpportunity({
      ...row, startDate: new Date('2026-10-01T09:00:00+10:00'),
      summary: 'A supplied summary.', tags: ['Invite-only'], location
    })
    expect(response.startDate).toBe('2026-09-30T23:00:00.000Z')
    expect(response.summary).toBe('A supplied summary.')
    expect(response.tags).toEqual(['Invite-only'])
    expect(response.location).toEqual(location)
  })

  it('constructs the frontend model using the first nonblank normalized paragraph', () => {
    const response = serializeOpportunity({ ...row, fullText: ['  ', '  First\n paragraph   here. ', 'Next paragraph.'] })
    expect(toOpportunity(response).summary).toBe('First paragraph here.')
    expect(response).not.toHaveProperty('summary')
  })

  it.each([undefined, '', '  '])('falls back for an absent or empty summary (%s)', summary => {
    expect(toOpportunity({ ...serializeOpportunity(row), summary }).summary).toBe(row.fullText[0])
  })

  it('limits fallback summaries to 35 words, adding an ellipsis only when truncated', () => {
    const words = Array.from({ length: 36 }, (_, index) => `word${index}`)
    const response = serializeOpportunity({ ...row, fullText: [words.join(' ')] })
    expect(toOpportunity(response).summary).toBe(words.slice(0, 35).join(' ') + '…')
    expect(toOpportunity({ ...response, fullText: [words.slice(0, 35).join(' ')] }).summary)
      .toBe(words.slice(0, 35).join(' '))
  })

  it('preserves a supplied summary', () => {
    const response = { ...serializeOpportunity(row), summary: 'Use the supplied summary.' }
    expect(toOpportunity(response).summary).toBe(response.summary)
  })
})
