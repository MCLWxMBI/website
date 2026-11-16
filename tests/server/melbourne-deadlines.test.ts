import { describe, expect, it, vi } from 'vitest'
import { formatCalendarDate, formatMelbourneDateTime, melbourneDateKey, melbourneTimeZoneName } from '../../shared/utils/melbourne-time'
import { parseOpportunityDeadline, serializeOpportunityDeadline, sortOpportunitiesByDeadline, toStoredOpportunityDeadline } from '../../shared/utils/opportunity-deadline'
import { getOpportunityStatus } from '../../app/utils/opportunity-status'
import { matchesSubmissionDeadline } from '../../app/utils/opportunity-deadline-filter'

describe('one Melbourne deadline rule', () => {
  it.each([
    ['2027-01', '2026-12-31T13:00:00.000Z'], ['2027-07', '2027-06-30T14:00:00.000Z'],
    ['2026-11', '2026-10-31T13:00:00.000Z'], ['0001-01', '0000-12-31T14:20:08.000Z'],
    ['1895-02', '1895-01-31T14:20:08.000Z']
  ])('interprets %s as the start of the Melbourne month', (month, instant) => {
    expect(parseOpportunityDeadline(month).toISOString()).toBe(instant)
    const stored = toStoredOpportunityDeadline(month)
    expect(stored.submissionDeadline.toISOString()).toBe(`${month}-01T00:00:00.000Z`)
    expect(serializeOpportunityDeadline(stored.submissionDeadline, stored.submissionDeadlinePrecision)).toBe(month)
    const value = { startDate: null, submissionDeadline: month }, boundary = Date.parse(instant)
    expect(getOpportunityStatus(value, boundary - 1)).toBe('open')
    expect(getOpportunityStatus(value, boundary)).toBe('closed')
    expect(getOpportunityStatus(value, boundary + 1)).toBe('closed')
  })
  it('sorts by the effective instant and ID before pagination, with matching calendar filters', () => {
    const records = Object.freeze([
      { id: 'middle', submissionDeadline: '2026-10-31T20:00:00Z' },
      { id: 'z-month', submissionDeadline: '2026-11' },
      { id: 'a-tie', submissionDeadline: '2026-10-31T13:00:00Z' },
      { id: 'before', submissionDeadline: '2026-10-31T12:59:59Z' }
    ])
    const sorted = sortOpportunitiesByDeadline(records)
    expect(sorted.map(row => row.id)).toEqual(['before', 'a-tie', 'z-month', 'middle'])
    expect(sorted.slice(0, 2).map(row => row.id)).toEqual(['before', 'a-tie'])
    expect(records[0]!.id).toBe('middle')
    expect(sorted.filter(row => matchesSubmissionDeadline(row, { from: '2026-11-01', to: '2026-11-01' })).map(row => row.id)).toEqual(['a-tie', 'z-month', 'middle'])
  })
})

describe('consistent Melbourne labels and calendar-only dates', () => {
  it('uses date-specific AEST/AEDT labels on both sides of each clock change', () => {
    expect(melbourneTimeZoneName('2026-04-04T15:59:59Z')).toBe('AEDT')
    expect(melbourneTimeZoneName('2026-04-04T16:00:00Z')).toBe('AEST')
    expect(melbourneTimeZoneName('2026-10-03T15:59:59Z')).toBe('AEST')
    expect(melbourneTimeZoneName('2026-10-03T16:00:00Z')).toBe('AEDT')
    for (const instant of ['2027-01-15T00:00:00Z', '2027-07-15T00:00:00Z']) {
      expect(formatMelbourneDateTime(instant)).toContain('Melbourne time (AE')
      expect(formatMelbourneDateTime(instant)).not.toMatch(/UTC|GMT/)
    }
  })
  it('keeps a recorded DATE unchanged and formats a capture instant on the Melbourne day', () => {
    vi.stubEnv('TZ', 'America/Los_Angeles')
    try {
      expect(formatCalendarDate('2027-01-01')).toBe('1 January 2027')
      expect(melbourneDateKey('2026-12-31T13:00:00Z')).toBe('2027-01-01')
      expect(formatMelbourneDateTime('2026-12-31T13:00:00Z')).toBe('1 January 2027, 00:00:00 Melbourne time (AEDT)')
      expect(() => formatCalendarDate('2027-02-30')).toThrow('valid calendar date')
    } finally { vi.unstubAllEnvs() }
  })
})
