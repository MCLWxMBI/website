import { describe, expect, it, vi } from 'vitest'
import { parseQuery, stringifyQuery } from 'vue-router'
import { matchesSubmissionDeadline, parseSubmissionDeadlineRange, validateSubmissionDeadlineRange } from '../../app/utils/opportunity-deadline-filter'
import { sortOpportunitiesByDeadline } from '../../shared/utils/opportunity-deadline'
import { getOpportunityReturnQuery } from '../../app/utils/opportunity-authority'
import { matchesOpportunityAccess, matchesOpportunitySearch } from '../../app/utils/opportunity-access'
import { makeOpportunity } from '../support/opportunity'

const matches = (deadline: string, from = '', to = '') => matchesSubmissionDeadline({ submissionDeadline: deadline }, { from, to })

describe('submission deadline range', () => {
  it('supports no bounds and either bound independently', () => {
    expect(matches('2026-11')).toBe(true)
    expect(matches('2026-11-05T23:59:59Z', '2026-11-06')).toBe(false)
    expect(matches('2026-11-06T00:00:00Z', '2026-11-06')).toBe(true)
    expect(matches('2026-11-06T23:59:59.999Z', '', '2026-11-06')).toBe(true)
    expect(matches('2026-11-07T00:00:00Z', '', '2026-11-06')).toBe(false)
  })
  it('includes the complete UTC day when both bounds are equal', () => {
    for (const deadline of ['2026-11-06T00:00:00Z', '2026-11-06T12:30:00Z', '2026-11-06T23:59:59.999Z']) {
      expect(matches(deadline, '2026-11-06', '2026-11-06')).toBe(true)
    }
    expect(matches('2026-11-05T23:59:59.999Z', '2026-11-06', '2026-11-06')).toBe(false)
    expect(matches('2026-11-07T00:00:00Z', '2026-11-06', '2026-11-06')).toBe(false)
  })
  it('uses the first day for month-only deadlines', () => {
    expect(matches('2026-11', '2026-11-01', '2026-11-30')).toBe(true)
    expect(matches('2026-11', '2026-11-02', '2026-11-30')).toBe(false)
    expect(matches('2026-11-06T23:59:59Z', '2026-11-02', '2026-11-30')).toBe(true)
    expect(matches('2026-12', '2026-11-01', '2026-11-30')).toBe(false)
  })
  it('handles leap days, year rollover, and supported year limits', () => {
    expect(matches('2024-02-29T23:59:59Z', '2024-02-29', '2024-02-29')).toBe(true)
    expect(matches('2024-03-01T00:00:00Z', '2024-02-29', '2024-02-29')).toBe(false)
    expect(matches('2027-01', '2026-12-31', '2027-01-01')).toBe(true)
    expect(matches('0001-01', '0001-01-01', '0001-01-01')).toBe(true)
    expect(matches('0099-12-31T12:00:00Z', '0099-12-31', '0099-12-31')).toBe(true)
    expect(matches('9999-12-31T23:59:59.999Z', '', '9999-12-31')).toBe(true)
  })
  it('does not reinterpret bounds in the browser timezone', () => {
    vi.stubEnv('TZ', 'Australia/Sydney')
    try {
      expect(matches('2026-11-05T23:59:59Z', '2026-11-06')).toBe(false)
      expect(matches('2026-11-06T23:59:59Z', '', '2026-11-06')).toBe(true)
    } finally { vi.unstubAllEnvs() }
  })
  it.each(['2026-02-29', '2026-02-30', '2026-13-01', '2026-00-01', '2026-11-00', '2026-11-31', '0000-01-01', '10000-01-01', '2026-11', '2026-1-01', ' 2026-11-01', '2026-11-01T00:00:00Z'])('rejects an invalid calendar bound %s', date => {
    expect(validateSubmissionDeadlineRange({ from: date, to: '' })).not.toBeNull()
    expect(validateSubmissionDeadlineRange({ from: '', to: date })).not.toBeNull()
    expect(parseSubmissionDeadlineRange(date, '2026-12-31')).toEqual({ from: '', to: '' })
  })
  it('rejects reversed ranges without treating them as matches', () => {
    expect(validateSubmissionDeadlineRange({ from: '2026-11-30', to: '2026-11-01' })).toContain('From date')
    expect(parseSubmissionDeadlineRange('2026-11-30', '2026-11-01')).toEqual({ from: '', to: '' })
    expect(matches('2026-11', '2026-11-30', '2026-11-01')).toBe(false)
  })
  it('round-trips query bounds and preserves them through detail-page return links', () => {
    const range = { from: '2026-11-01', to: '2026-11-30' }
    const query = parseQuery(stringifyQuery({ deadlineFrom: range.from, deadlineTo: range.to, authority: ['First', 'Second'], page: '2' }))
    expect(parseSubmissionDeadlineRange(query.deadlineFrom, query.deadlineTo)).toEqual(range)
    expect(getOpportunityReturnQuery(query)).toEqual({ deadlineFrom: range.from, deadlineTo: range.to, authority: ['First', 'Second'], page: '2' })
    expect(parseSubmissionDeadlineRange(undefined, undefined)).toEqual({ from: '', to: '' })
    expect(parseSubmissionDeadlineRange('2026-11-01', undefined)).toEqual({ from: '2026-11-01', to: '' })
  })
  it.each([null, 123, ['2026-11-01'], ['2026-11-01', '2026-11-02']].map(bound => [bound]))('ignores malformed or repeated query values %j', bound => {
    expect(parseSubmissionDeadlineRange(bound, '2026-11-30')).toEqual({ from: '', to: '' })
    expect(parseSubmissionDeadlineRange('2026-11-01', bound)).toEqual({ from: '', to: '' })
  })
  it('combines with other filters, sorts before pagination, and preserves source order', () => {
    const records = [
      makeOpportunity({ id: 'z', submissionDeadline: '2026-11-06T12:00:00Z' }),
      makeOpportunity({ id: 'outside', submissionDeadline: '2026-12' }),
      makeOpportunity({ id: 'month', submissionDeadline: '2026-11' }),
      makeOpportunity({ id: 'a', submissionDeadline: '2026-11-06T12:00:00Z' }),
      makeOpportunity({ id: 'invite', submissionDeadline: '2026-11', tags: ['Invite-only'] })
    ]
    const original = [...records]
    const results = sortOpportunitiesByDeadline(records.filter(row => matchesSubmissionDeadline(row, { from: '2026-11-01', to: '2026-11-30' })
      && matchesOpportunitySearch(row, 'climate change') && matchesOpportunityAccess(row, ['public'])))
    expect(results.map(row => row.id)).toEqual(['month', 'a', 'z'])
    expect(results.slice(0, 2).map(row => row.id)).toEqual(['month', 'a'])
    expect(records).toEqual(original)
  })
})
