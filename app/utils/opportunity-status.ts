import { opportunityStatuses } from '~/types/opportunity'
import type { Opportunity, OpportunityStatus, OpportunityWithStatus } from '../../shared/types/opportunity'
import { parseOpportunityDeadline, sortOpportunitiesByDeadline } from '../../shared/utils/opportunity-deadline'

type StatusDates = Pick<Opportunity, 'startDate' | 'submissionDeadline'>

export const getOpportunityStatus = (
  opportunity: StatusDates,
  currentTime: number
): OpportunityStatus => {
  if (currentTime >= parseOpportunityDeadline(opportunity.submissionDeadline).getTime()) return 'closed'
  if (opportunity.startDate && currentTime < Date.parse(opportunity.startDate)) return 'upcoming'
  return 'open'
}

// An absent status query shows current and closed consultations; Upcoming is opt-in.
export const defaultOpportunityStatuses: readonly OpportunityStatus[] = ['open', 'closed']

export function parseOpportunityStatuses(value: unknown): OpportunityStatus[] {
  if (value === 'none') return []
  if (typeof value !== 'string') return [...defaultOpportunityStatuses]
  const tokens = value.split(',')
  const selected = opportunityStatuses.filter(status => tokens.includes(status))
  return selected.length ? selected : [...defaultOpportunityStatuses]
}

export function serializeOpportunityStatuses(selected: readonly OpportunityStatus[]): string | undefined {
  const ordered = opportunityStatuses.filter(status => selected.includes(status))
  if (ordered.length === defaultOpportunityStatuses.length && defaultOpportunityStatuses.every(status => ordered.includes(status))) return undefined
  return ordered.length ? ordered.join(',') : 'none'
}

export function sortOpportunitiesByStatus<T extends Pick<OpportunityWithStatus, 'id' | 'status' | 'submissionDeadline'>>(
  opportunities: readonly T[]
): T[] {
  return opportunityStatuses.flatMap(status => sortOpportunitiesByDeadline(opportunities.filter(item => item.status === status)))
}
