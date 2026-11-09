import { describe, expect, it } from 'vitest'
import { opportunityStatuses, type OpportunityStatus } from '../../shared/types/opportunity'
import { defaultOpportunityStatuses, getOpportunityStatus, parseOpportunityStatuses,
  serializeOpportunityStatuses, sortOpportunitiesByStatus } from '../../app/utils/opportunity-status'
import { makeOpportunity } from '../support/opportunity'

describe('catalogue status choices', () => {
  it('defaults to open and closed, with Upcoming opt-in', () => {
    expect(defaultOpportunityStatuses).toEqual(['open', 'closed'])
    expect(parseOpportunityStatuses(undefined)).toEqual(['open', 'closed'])
    expect(serializeOpportunityStatuses(['closed', 'open'])).toBeUndefined()
    const selected = parseOpportunityStatuses(undefined)
    selected.push('upcoming')
    expect(defaultOpportunityStatuses).toEqual(['open', 'closed'])
  })

  it('round-trips every checkbox combination, including none and all', () => {
    for (let mask = 0; mask < 8; mask++) {
      const selected = opportunityStatuses.filter((_, index) => mask & (1 << index))
      expect(parseOpportunityStatuses(serializeOpportunityStatuses(selected))).toEqual(selected)
    }
    expect(serializeOpportunityStatuses([])).toBe('none')
    expect(parseOpportunityStatuses('none')).toEqual([])
    expect(serializeOpportunityStatuses(['closed', 'upcoming', 'open', 'open']))
      .toBe('upcoming,open,closed')
  })

  it.each([undefined, null, '', 'unknown', 'OPEN', 1, ['upcoming'], ['open', 'closed']])
    ('falls back to defaults for a missing or invalid query %j', value => {
      expect(parseOpportunityStatuses(value)).toEqual(defaultOpportunityStatuses)
    })

  it('retains explicit selections and ignores unknown or duplicate tokens', () => {
    expect(parseOpportunityStatuses('closed')).toEqual(['closed'])
    expect(parseOpportunityStatuses('upcoming')).toEqual(['upcoming'])
    expect(parseOpportunityStatuses('closed,unknown,upcoming,closed')).toEqual(['upcoming', 'closed'])
  })
})

describe('status-first catalogue order', () => {
  const now = Date.parse('2026-11-15T00:00:00Z')
  const records = [
    makeOpportunity({ id: 'closed-exact', submissionDeadline: '2026-11-06T17:00:00Z' }),
    makeOpportunity({ id: 'open-b-month', submissionDeadline: '2027-01' }),
    makeOpportunity({ id: 'upcoming-later', startDate: '2027-02-01T00:00:00Z', submissionDeadline: '2027-03' }),
    makeOpportunity({ id: 'closed-month', submissionDeadline: '2026-11' }),
    makeOpportunity({ id: 'open-sooner', submissionDeadline: '2026-12-06T17:00:00Z' }),
    makeOpportunity({ id: 'upcoming-sooner', startDate: '2026-12-01T00:00:00Z', submissionDeadline: '2027-02' }),
    makeOpportunity({ id: 'open-a-exact', submissionDeadline: '2027-01-01T00:00:00Z' })
  ].map(row => ({ ...row, status: getOpportunityStatus(row, now) }))

  it('shows Upcoming, Open, Closed, sorting months/exact dates and ID ties within each group without mutating input', () => {
    const input = Object.freeze([...records])
    const sorted = sortOpportunitiesByStatus(input)
    expect(sorted.map(row => row.id)).toEqual([
      'upcoming-sooner', 'upcoming-later', 'open-sooner', 'open-a-exact', 'open-b-month', 'closed-month', 'closed-exact'
    ])
    expect(input).toEqual(records)
    expect(sorted).not.toBe(input)
  })

  it('shows only Open then Closed by default; no selected statuses gives no results', () => {
    const filtered = (selected: readonly OpportunityStatus[]) => sortOpportunitiesByStatus(records.filter(row => selected.includes(row.status)))
    expect(filtered(defaultOpportunityStatuses).map(row => row.id))
      .toEqual(['open-sooner', 'open-a-exact', 'open-b-month', 'closed-month', 'closed-exact'])
    expect(filtered(parseOpportunityStatuses('none'))).toEqual([])
  })

  it('orders the entire result set before slicing 12-item pages', () => {
    const open = Array.from({ length: 14 }, (_, index) => ({ id: `open-${String(index).padStart(2, '0')}`,
      status: 'open' as const, submissionDeadline: `2026-12-${String(index + 1).padStart(2, '0')}T00:00:00Z` }))
    const all = [...open.toReversed(), ...records.filter(row => row.status !== 'open')]
    const sorted = sortOpportunitiesByStatus(all)
    expect(sorted.slice(0, 12).map(row => row.id))
      .toEqual(['upcoming-sooner', 'upcoming-later', ...open.slice(0, 10).map(row => row.id)])
    expect(sorted.slice(12).map(row => row.id))
      .toEqual([...open.slice(10).map(row => row.id), 'closed-month', 'closed-exact'])
  })

  it('uses current status when an opening or month-only closing instant is reached', () => {
    const opportunity = makeOpportunity({ startDate: '2026-12-01T00:00:00Z', submissionDeadline: '2027-01' })
    const matchesDefault = (time: string) => defaultOpportunityStatuses.includes(getOpportunityStatus(opportunity, Date.parse(time)))
    expect(matchesDefault('2026-11-30T23:59:59.999Z')).toBe(false)
    expect(matchesDefault('2026-12-01T00:00:00Z')).toBe(true)
    expect(getOpportunityStatus(opportunity, Date.parse('2027-01-01T00:00:00Z'))).toBe('closed')
  })
})
