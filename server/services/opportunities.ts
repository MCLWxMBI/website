import type { OpportunityRecord } from '../database/schema'
import type { OpportunityResponse } from '../../shared/types/opportunity'

// The public catalogue will use this boundary when its API is connected.
export function serializeOpportunity(row: OpportunityRecord): OpportunityResponse {
  return {
    id: row.id,
    title: row.title,
    fullText: row.fullText,
    sourceUrl: row.sourceUrl,
    website: row.websiteId,
    sourceOrg: row.sourceOrg,
    jurisdiction: row.jurisdiction,
    startDate: row.startDate?.toISOString() ?? null,
    submissionDeadline: row.submissionDeadline.toISOString(),
    category: row.category,
    tags: row.tags,
    ...(row.summary === null ? {} : { summary: row.summary }),
    ...(row.location === null ? {} : { location: row.location })
  }
}
