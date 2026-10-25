import { describe, expect, it } from 'vitest'
import { opportunities } from '../../app/data/opportunities'
import { getOpportunityStatus } from '../../app/utils/opportunity-status'
import {
  formatOpportunityDate,
  parseOpportunityDeadline,
  serializeOpportunityDeadline,
  sortOpportunitiesByDeadline,
  toStoredOpportunityDeadline
} from '../../shared/utils/opportunity-deadline'
import { toOpportunity } from '../../shared/utils/opportunity'
import type { OpportunityResponse } from '../../shared/types/opportunity'

describe('deadline formats and persistence mapping', () => {
  it.each(['0001-01', '2026-11', '9999-12'])('round-trips a month without losing precision (%s)', value => {
    const stored = toStoredOpportunityDeadline(value)
    expect(stored.submissionDeadline.toISOString()).toBe(`${value}-01T00:00:00.000Z`)
    expect(stored.submissionDeadlinePrecision).toBe('month')
    expect(serializeOpportunityDeadline(stored.submissionDeadline, stored.submissionDeadlinePrecision)).toBe(value)
  })

  it('preserves the instant and precision of exact deadlines, including leap days', () => {
    const value = '2028-02-29T17:23:45.123Z'
    const stored = toStoredOpportunityDeadline(value)
    expect(stored.submissionDeadlinePrecision).toBe('datetime')
    expect(serializeOpportunityDeadline(stored.submissionDeadline, stored.submissionDeadlinePrecision)).toBe(value)
    expect(serializeOpportunityDeadline(new Date('2026-11-01T00:00:00Z'), 'datetime'))
      .toBe('2026-11-01T00:00:00.000Z')
  })

  it.each([
    '', '2026', '0000-01', '10000-01', '2026-00', '2026-13', '2026-1', '2026-01-01',
    '2026-11 ', 'November 2026', '2026-02-30T00:00:00Z', '2026-11-01T24:00:00Z',
    '2026-11-01T00:00:00', '2026-11-01T00:00:00+11:00', 'infinity'
  ])('rejects an invalid public deadline (%s)', value => {
    expect(() => toStoredOpportunityDeadline(value)).toThrow('Deadline must be')
  })

  it('rejects a persisted month timestamp that is not midnight on the first day in UTC', () => {
    expect(() => serializeOpportunityDeadline(new Date('2026-11-02T00:00:00Z'), 'month')).toThrow('midnight UTC')
    expect(() => serializeOpportunityDeadline(new Date('2026-11-01T00:00:00+11:00'), 'month')).toThrow('midnight UTC')
  })

  it('validates deadlines at the frontend response boundary', () => {
    const response: OpportunityResponse = { ...opportunities[0]!, submissionDeadline: '2026-13' }
    expect(() => toOpportunity(response)).toThrow('Deadline must be')
  })
})

describe('deadline presentation', () => {
  it('omits the invented day for month-only deadlines in both display styles', () => {
    expect(formatOpportunityDate('2026-11')).toBe('Nov 2026')
    expect(formatOpportunityDate('2026-11', 'long')).toBe('November 2026')
  })

  it('keeps full dates and opening timestamps in UTC', () => {
    expect(formatOpportunityDate('2026-11-06T23:59:59Z')).toBe('6 Nov 2026')
    expect(formatOpportunityDate('2026-11-06T23:59:59Z', 'long')).toBe('6 November 2026')
    expect(formatOpportunityDate('2026-09-21T00:00:00Z', 'long')).toBe('21 September 2026')
  })
})

describe('deadline status', () => {
  it.each(['2026-11', '2027-01'])('closes exactly at month start (%s)', submissionDeadline => {
    const closing = parseOpportunityDeadline(submissionDeadline).getTime()
    const opportunity = { startDate: null, submissionDeadline }
    expect(getOpportunityStatus(opportunity, closing - 1)).toBe('open')
    expect(getOpportunityStatus(opportunity, closing)).toBe('closed')
    expect(getOpportunityStatus(opportunity, closing + 1)).toBe('closed')
  })

  it('retains upcoming, opening-equality and exact closing behavior', () => {
    const opportunity = { startDate: '2026-09-21T00:00:00Z', submissionDeadline: '2026-11' }
    const opening = Date.parse(opportunity.startDate)
    expect(getOpportunityStatus(opportunity, opening - 1)).toBe('upcoming')
    expect(getOpportunityStatus(opportunity, opening)).toBe('open')
    const exact = { ...opportunity, submissionDeadline: '2026-11-06T17:00:00Z' }
    const closing = Date.parse(exact.submissionDeadline)
    expect(getOpportunityStatus(exact, closing - 1)).toBe('open')
    expect(getOpportunityStatus(exact, closing)).toBe('closed')
  })
})

describe('chronological catalogue order', () => {
  it('sorts mixed formats across statuses before pagination without mutating the input', () => {
    const input = Object.freeze([
      { id: 'last', submissionDeadline: '2027-02-02T00:00:00Z', status: 'upcoming' },
      { id: 'b', submissionDeadline: '2027-02', status: 'open' },
      { id: 'first', submissionDeadline: '2027-01-31T23:59:59Z', status: 'closed' },
      { id: 'a', submissionDeadline: '2027-02-01T00:00:00Z', status: 'open' }
    ])
    const sorted = sortOpportunitiesByDeadline(input)
    expect(sorted.map(item => item.id)).toEqual(['first', 'a', 'b', 'last'])
    expect(sorted.slice(0, 2).map(item => item.id)).toEqual(['first', 'a'])
    expect(sorted.slice(2, 4).map(item => item.id)).toEqual(['b', 'last'])
    expect(input.map(item => item.id)).toEqual(['last', 'b', 'first', 'a'])
  })

  it('keeps both mock formats, with the November-only example before November 6', () => {
    const monthOnly = opportunities.find(item => item.id === 'nature-repair-methods')!
    const exact = opportunities.find(item => item.id === 'cultural-landscape-guidelines')!
    expect(monthOnly.submissionDeadline).toBe('2026-11')
    expect(monthOnly.startDate).toBe('2026-09-21T00:00:00Z')
    expect(exact.submissionDeadline).toBe('2026-11-06T23:59:59Z')
    expect(sortOpportunitiesByDeadline([exact, monthOnly])).toEqual([monthOnly, exact])
    for (const opportunity of opportunities) {
      expect(() => parseOpportunityDeadline(opportunity.submissionDeadline)).not.toThrow()
    }
  })
})
