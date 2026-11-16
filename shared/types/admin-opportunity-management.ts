import type { OpportunityDetailResponse, OpportunityResponse, PointGeometry } from './opportunity'

export interface AdminOpportunityDetail extends OpportunityDetailResponse {
  deleted: boolean
  version: string
}

export interface AdminOpportunityList {
  items: AdminOpportunityDetail[]
  total: number
  page: number
  pageSize: number
}

export interface UpdateOpportunityRequest extends Pick<OpportunityResponse,
  'title' | 'fullText' | 'jurisdiction' | 'startDate' | 'submissionDeadline' | 'category'> {
  expectedVersion: string
  summary?: string
  /** Omit to retain the existing geometry, including boundaries; null removes it. */
  location?: { label: string; geometry: PointGeometry } | null
}
