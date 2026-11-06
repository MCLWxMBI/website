import { parseOpportunityDeadline } from '~~/shared/utils/opportunity-deadline'

export interface SubmissionDeadlineRange {
  from: string
  to: string
}

const dayMs = 24 * 60 * 60 * 1000
const datePattern = /^(?!0000)[0-9]{4}-(0[1-9]|1[0-2])-[0-9]{2}$/

function calendarDate(value: string): number | null {
  if (!datePattern.test(value)) return null
  const time = Date.parse(`${value}T00:00:00.000Z`)
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : null
}

export function validateSubmissionDeadlineRange(range: SubmissionDeadlineRange): string | null {
  if (range.from && calendarDate(range.from) === null) return 'Enter a valid From date (years 0001–9999).'
  if (range.to && calendarDate(range.to) === null) return 'Enter a valid To date (years 0001–9999).'
  if (range.from && range.to && range.from > range.to) return 'From date must be on or before To date.'
  return null
}

// Reject the whole URL range rather than silently applying a partial invalid range.
export function parseSubmissionDeadlineRange(from: unknown, to: unknown): SubmissionDeadlineRange {
  if ((from !== undefined && typeof from !== 'string') || (to !== undefined && typeof to !== 'string')) return { from: '', to: '' }
  const range = { from: (from as string | undefined) ?? '', to: (to as string | undefined) ?? '' }
  return validateSubmissionDeadlineRange(range) ? { from: '', to: '' } : range
}

export function matchesSubmissionDeadline(
  opportunity: { submissionDeadline: string },
  range: SubmissionDeadlineRange
): boolean {
  if (validateSubmissionDeadlineRange(range)) return false
  const deadline = parseOpportunityDeadline(opportunity.submissionDeadline).getTime()
  const from = range.from ? calendarDate(range.from)! : null
  const to = range.to ? calendarDate(range.to)! + dayMs : null
  return (from === null || deadline >= from) && (to === null || deadline < to)
}
