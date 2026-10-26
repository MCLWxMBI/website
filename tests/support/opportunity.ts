import type { Opportunity } from '../../shared/types/opportunity'

// Small test-only records; the complete development collection lives in SQL.
export function makeOpportunity(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: 'test-consultation', title: 'Test consultation', summary: 'A short summary.',
    fullText: ['Consultation text.'], sourceUrl: 'https://example.gov.au/consultation',
    website: 'test-platform', sourceOrg: 'Test authority', jurisdiction: 'Victoria',
    startDate: null, submissionDeadline: '2026-11-06T17:00:00Z',
    category: ['Climate change'], tags: null, ...overrides
  }
}
