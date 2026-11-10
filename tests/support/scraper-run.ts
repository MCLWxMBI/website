import type { StoredRun } from '../../server/services/admin-scraper-runs'

export function runSource(overrides: Record<string, unknown> = {}) {
  return { website_index_id: '9007199254740993', source_name: 'Historical source',
    source_url: 'https://example.gov.au/index', status: 'passed', discovered_count: 4,
    processed_count: 3, passed_count: 2, invalid_count: 1, failed_count: 0, skipped_count: 1,
    error: null, ...overrides }
}
export function storedRun(overrides: Partial<StoredRun> & { extractedOpportunities?: unknown } = {}) {
  return { id: 9007199254740995n, startedAt: new Date('2026-11-01T03:00:00Z'),
    finishedAt: new Date('2026-11-01T03:10:00Z'), status: 'passed', sources: [runSource()],
    extractedOpportunities: [{ website_index_id: '9007199254740993', source_name: 'Historical source', titles: ['Repeated title', 'Repeated title'] }], ...overrides }
}
