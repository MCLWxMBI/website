import type { DeadlinePrecision, Opportunity } from '../types/opportunity'

const monthPattern = /^(?!0000)[0-9]{4}-(0[1-9]|1[0-2])$/
const timestampPattern = /^(?!0000)[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?Z$/

// Month-only deadlines intentionally close at the start of the month, in UTC.
export function parseOpportunityDeadline(value: string): Date {
  const monthOnly = monthPattern.test(value)
  const timestamp = monthOnly ? `${value}-01T00:00:00.000Z` : value
  const date = new Date(timestamp)
  if ((!monthOnly && !timestampPattern.test(value))
    || !Number.isFinite(date.getTime())
    || date.toISOString().slice(0, 19) !== timestamp.slice(0, 19)) {
    throw new Error('Deadline must be a valid YYYY-MM or UTC timestamp (years 0001–9999).')
  }
  return date
}

// Writers must persist both fields, including when updating an existing deadline.
export function toStoredOpportunityDeadline(value: string): {
  submissionDeadline: Date
  submissionDeadlinePrecision: DeadlinePrecision
} {
  return {
    submissionDeadline: parseOpportunityDeadline(value),
    submissionDeadlinePrecision: monthPattern.test(value) ? 'month' : 'datetime'
  }
}

export function serializeOpportunityDeadline(date: Date, precision: DeadlinePrecision): string {
  const timestamp = date.toISOString()
  if (precision === 'datetime') return timestamp
  const month = timestamp.slice(0, 7)
  if (!monthPattern.test(month) || timestamp !== `${month}-01T00:00:00.000Z`) {
    throw new Error('Month-only deadlines must be the first day at midnight UTC.')
  }
  return month
}

export function formatOpportunityDate(value: string, month: 'short' | 'long' = 'short'): string {
  return new Intl.DateTimeFormat('en-AU', {
    ...(monthPattern.test(value) ? {} : { day: 'numeric' }),
    month,
    year: 'numeric',
    timeZone: 'UTC'
  }).format(parseOpportunityDeadline(value))
}

export function sortOpportunitiesByDeadline<T extends Pick<Opportunity, 'id' | 'submissionDeadline'>>(
  opportunities: readonly T[]
): T[] {
  return [...opportunities].sort((a, b) => {
    const difference = parseOpportunityDeadline(a.submissionDeadline).getTime()
      - parseOpportunityDeadline(b.submissionDeadline).getTime()
    return difference || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  })
}
