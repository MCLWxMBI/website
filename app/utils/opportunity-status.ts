import type { Opportunity, OpportunityStatus } from '~/types/opportunity'

type StatusDates = Pick<Opportunity, 'startDate' | 'submissionDeadline'>

export const getOpportunityStatus = (
  opportunity: StatusDates,
  currentTime: number
): OpportunityStatus => {
  if (currentTime >= Date.parse(opportunity.submissionDeadline)) return 'closed'
  if (opportunity.startDate && currentTime < Date.parse(opportunity.startDate)) return 'upcoming'
  return 'open'
}
