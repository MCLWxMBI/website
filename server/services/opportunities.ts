import type { OpportunityRecord } from '../database/schema'
import { createError } from 'h3'
import type { OpportunitiesResponse, OpportunityDetailResponse, OpportunityResponse } from '../../shared/types/opportunity'
import { serializeOpportunityDeadline } from '../../shared/utils/opportunity-deadline'

// Keep storage fields and scrape history out of public responses.
export function serializeOpportunity(row: OpportunityRecord, websiteTags: string[] = []): OpportunityResponse {
  return {
    id: row.id,
    title: row.title,
    fullText: row.fullText,
    sourceUrl: row.sourceUrl,
    website: row.websiteId.toString(),
    sourceOrg: row.sourceOrg,
    jurisdiction: row.jurisdiction,
    startDate: row.startDate?.toISOString() ?? null,
    submissionDeadline: serializeOpportunityDeadline(row.submissionDeadline, row.submissionDeadlinePrecision),
    category: row.category,
    tags: websiteTags.length ? websiteTags : null,
    ...(row.summary === null ? {} : { summary: row.summary }),
    ...(row.location === null ? {} : { location: row.location })
  }
}

export interface OpportunityRepository {
  all: () => Promise<{ opportunity: OpportunityRecord; websiteTags: string[] }[]>
  findDetailById: (id: string) => Promise<{ opportunity: OpportunityRecord; websiteTags: string[] } | null>
}

const unavailable = () => createError({
  statusCode: 503,
  statusMessage: 'Opportunities are temporarily unavailable.'
})

export async function listOpportunities(repository: OpportunityRepository): Promise<OpportunitiesResponse> {
  try {
    return (await repository.all()).map(row => serializeOpportunity(row.opportunity, row.websiteTags))
  } catch {
    throw unavailable()
  }
}

export async function readOpportunity(id: string, repository: OpportunityRepository): Promise<OpportunityDetailResponse> {
  try {
    const detail = await repository.findDetailById(id)
    if (detail) return { opportunity: serializeOpportunity(detail.opportunity, detail.websiteTags), websiteTags: detail.websiteTags }
  } catch {
    throw unavailable()
  }
  throw createError({ statusCode: 404, statusMessage: 'Opportunity not found.' })
}
