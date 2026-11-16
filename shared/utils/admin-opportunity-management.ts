import type { UpdateOpportunityRequest } from '../types/admin-opportunity-management'
import { OpportunityValidationError, validateCreateOpportunity } from './admin-opportunity'

export function validateOpportunityVersion(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) {
    throw new OpportunityValidationError('form', 'Reload the listing before saving or deleting.')
  }
  return value
}

export function validateUpdateOpportunity(value: unknown): UpdateOpportunityRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new OpportunityValidationError('form', 'Supply a valid opportunity.')
  const body = value as Record<string, unknown>
  const allowed = ['expectedVersion', 'title', 'fullText', 'summary', 'jurisdiction', 'startDate', 'submissionDeadline', 'category', 'location']
  if (Object.keys(body).some(key => !allowed.includes(key))) throw new OpportunityValidationError('form', 'Unsupported fields were supplied.')
  const { expectedVersion, ...content } = body
  // Reuse publication rules without accepting changes to source identity or tags.
  const valid = validateCreateOpportunity({ ...content, sourceUrl: 'https://validation.invalid/listing', organisation: { existingId: '1' } })
  return { expectedVersion: validateOpportunityVersion(expectedVersion), title: valid.title, fullText: valid.fullText,
    jurisdiction: valid.jurisdiction, startDate: valid.startDate, submissionDeadline: valid.submissionDeadline,
    category: valid.category, ...(valid.summary ? { summary: valid.summary } : {}),
    ...(body.location === undefined ? {} : { location: valid.location ?? null }) }
}
