import type { Opportunity, OpportunityResponse } from '../types/opportunity'
import { parseOpportunityDeadline } from './opportunity-deadline'

export function toOpportunity(response: OpportunityResponse): Opportunity {
  parseOpportunityDeadline(response.submissionDeadline)
  if (response.summary?.trim()) return { ...response, summary: response.summary }

  const paragraph = response.fullText.find(value => value.trim()) ?? ''
  const words = paragraph.trim().split(/\s+/).filter(Boolean)
  const summary = words.slice(0, 35).join(' ') + (words.length > 35 ? '…' : '')
  return { ...response, summary }
}
