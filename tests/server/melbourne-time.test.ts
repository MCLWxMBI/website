import { describe, expect, it, vi } from 'vitest'
import { formatMelbourneDateTime, isValidCalendarDate, melbourneDateTimeToUtc, melbourneInputsFromUtc, melbourneTimeChoices } from '../../shared/utils/melbourne-time'
import { buildCreateOpportunity, draftFromOpportunity, newOpportunityDraft } from '../../app/utils/opportunity-create-state'
import { makeOpportunity } from '../support/opportunity'

const draft = () => ({ ...newOpportunityDraft(), title: 'Local time listing', sourceUrl: 'https://example.gov.au/local',
  sourceOrg: 'Authority', sourceIndexId: '1', jurisdiction: 'Victoria' as const, paragraphs: [{ key: 1, text: 'Content.' }],
  categories: ['Climate change' as const], deadlineDate: '2027-11-06' })

describe('Melbourne local time conversion', () => {
  it('uses the selected date’s summer/winter offset, including local midnight and year rollover', () => {
    expect(melbourneDateTimeToUtc('2027-01-15', '17:00')).toBe('2027-01-15T06:00:00.000Z')
    expect(melbourneDateTimeToUtc('2027-07-15', '17:00')).toBe('2027-07-15T07:00:00.000Z')
    expect(melbourneDateTimeToUtc('2027-01-15')).toBe('2027-01-14T13:00:00.000Z')
    expect(melbourneDateTimeToUtc('2027-07-15')).toBe('2027-07-14T14:00:00.000Z')
    expect(melbourneDateTimeToUtc('2027-01-01')).toBe('2026-12-31T13:00:00.000Z')
    expect(melbourneDateTimeToUtc('2024-02-29', '00:00:00.123')).toBe('2024-02-28T13:00:00.123Z')
  })
  // Victorian clock changes: https://business.vic.gov.au/business-information/daylight-saving
  it('rejects the spring gap and requires a choice for the repeated autumn hour', () => {
    expect(melbourneTimeChoices('2026-10-04', '02:30')).toEqual([])
    expect(() => melbourneDateTimeToUtc('2026-10-04', '02:30')).toThrow('skipped')
    const choices = melbourneTimeChoices('2027-04-04', '02:30')
    expect(choices).toEqual([{ utc: '2027-04-03T15:30:00.000Z', offset: 'UTC+11:00' }, { utc: '2027-04-03T16:30:00.000Z', offset: 'UTC+10:00' }])
    expect(() => melbourneDateTimeToUtc('2027-04-04', '02:30')).toThrow('occurs twice')
    expect(() => melbourneDateTimeToUtc('2027-04-04', '02:30', 'unrelated')).toThrow('occurs twice')
    for (const choice of choices) expect(melbourneDateTimeToUtc('2027-04-04', '02:30', choice.utc)).toBe(choice.utc)
    expect(melbourneDateTimeToUtc('2026-10-04', '03:00')).toBe('2026-10-03T16:00:00.000Z')
  })
  it('round-trips both repeated occurrences, seconds, and milliseconds', () => {
    for (const value of ['2027-04-03T15:30:12.345Z', '2027-04-03T16:30:12.345Z', '2027-11-06T23:59:59.789Z', '2027-07-15T00:00:00.000Z']) {
      const local = melbourneInputsFromUtc(value)
      expect(melbourneDateTimeToUtc(local.date, local.time, local.occurrence)).toBe(value)
      const opportunity = makeOpportunity({ website: '1', submissionDeadline: value })
      expect(buildCreateOpportunity(draftFromOpportunity(opportunity)).submissionDeadline).toBe(value)
    }
  })
  it('is independent of the computer timezone and the current date', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2035-07-01T00:00:00Z')); vi.stubEnv('TZ', 'America/Los_Angeles')
    try { expect(melbourneDateTimeToUtc('2027-01-15', '17:00')).toBe('2027-01-15T06:00:00.000Z') }
    finally { vi.useRealTimers(); vi.unstubAllEnvs() }
  })
  it.each(['2027-02-29', '2027-02-30', '0000-01-01', '10000-01-01', '2027-1-01', ''])('rejects invalid dates %s', date => {
    expect(isValidCalendarDate(date)).toBe(false)
    expect(() => melbourneDateTimeToUtc(date)).toThrow('valid date')
  })
  it.each(['24:00', '12:60', '12:00:60', '2:30', '00:00Z', '12:00:00.1234', ' '])('rejects invalid times %s', time => {
    expect(() => melbourneDateTimeToUtc('2027-01-15', time)).toThrow('valid time')
  })
  it('handles early years and historical second offsets without silently rolling into year zero', () => {
    expect(melbourneDateTimeToUtc('0001-01-01', '12:00')).toBe('0001-01-01T02:20:08.000Z')
    expect(() => melbourneDateTimeToUtc('0001-01-01')).toThrow('supported range')
    expect(melbourneDateTimeToUtc('9999-12-31', '23:59:59.999')).toBe('9999-12-31T12:59:59.999Z')
  })
  it('formats the effective local time and offset for preview and details', () => {
    expect(formatMelbourneDateTime('2027-01-14T13:00:00Z')).toBe('15 January 2027, 00:00:00 Melbourne time (AEDT)')
    expect(formatMelbourneDateTime('2027-07-15T07:00:00.123Z')).toBe('15 July 2027, 17:00:00.123 Melbourne time (AEST)')
  })
})

describe('optional admin times', () => {
  it('defaults dates without times to local midnight and keeps a completely absent opening null', () => {
    expect(buildCreateOpportunity(draft())).toMatchObject({ startDate: null, submissionDeadline: '2027-11-05T13:00:00.000Z' })
    expect(buildCreateOpportunity({ ...draft(), startDate: '2027-07-15' }).startDate).toBe('2027-07-14T14:00:00.000Z')
    expect(() => buildCreateOpportunity({ ...draft(), startTime: '17:00' })).toThrow('opening date')
    expect(() => buildCreateOpportunity({ ...draft(), deadlineDate: '', deadlineTime: '17:00' })).toThrow('valid date')
  })
  it('validates opening order after conversion and keeps month-only deadlines at Melbourne month start', () => {
    const month = { ...draft(), deadlineMode: 'month' as const, deadlineMonth: '2027-11', startDate: '2027-11-01', startTime: '' }
    expect(buildCreateOpportunity(month)).toMatchObject({ submissionDeadline: '2027-11', startDate: '2027-10-31T13:00:00.000Z' })
    expect(() => buildCreateOpportunity({ ...month, startTime: '00:00:01' })).toThrow('Opening')
    expect(() => buildCreateOpportunity({ ...draft(), startDate: '2027-11-06', startTime: '00:00:01' })).toThrow('Opening')
  })
})
