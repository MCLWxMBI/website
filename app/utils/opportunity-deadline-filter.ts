import { isValidCalendarDate, melbourneCalendarDay } from '~~/shared/utils/melbourne-time'
import { parseOpportunityDeadline } from '~~/shared/utils/opportunity-deadline'

export interface SubmissionDeadlineRange {
  from: string
  to: string
}

const dayMs = 24 * 60 * 60 * 1000
function calendarDate(value: string): number | null {
  return isValidCalendarDate(value) ? Date.parse(`${value}T00:00:00.000Z`) : null
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
  const instant = parseOpportunityDeadline(opportunity.submissionDeadline)
  if (!range.from && !range.to) return true
  // Compare calendar-day ordinals, so 23- and 25-hour Melbourne days work naturally.
  const deadline = melbourneCalendarDay(instant)
  const from = range.from ? calendarDate(range.from)! : null
  const to = range.to ? calendarDate(range.to)! + dayMs : null
  return (from === null || deadline >= from) && (to === null || deadline < to)
}
