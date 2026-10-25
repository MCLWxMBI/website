import type { Opportunity, OpportunityStatus } from '~/types/opportunity'
import { parseOpportunityDeadline } from '../../shared/utils/opportunity-deadline'

type StatusDates = Pick<Opportunity, 'startDate' | 'submissionDeadline'>

export const getOpportunityStatus = (
  opportunity: StatusDates,
  currentTime: number
): OpportunityStatus => {
  if (currentTime >= parseOpportunityDeadline(opportunity.submissionDeadline).getTime()) return 'closed'
  if (opportunity.startDate && currentTime < Date.parse(opportunity.startDate)) return 'upcoming'
  return 'open'
}
