import type { CreateOpportunityRequest } from '../../shared/types/admin-opportunity'
export function makeCreateOpportunity(overrides: Partial<CreateOpportunityRequest> = {}): CreateOpportunityRequest {
  return {
    title: 'Manual consultation', fullText: ['First paragraph.', 'Second paragraph.'], sourceUrl: 'https://example.gov.au/consultation',
    organisation: { existingId: '1' }, jurisdiction: 'Victoria',
    startDate: null, submissionDeadline: '2027-11-06T17:00:00Z', category: ['Climate change'], tags: null, ...overrides
  }
}
