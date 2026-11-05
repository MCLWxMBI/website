import type { OpportunityResponse, PointGeometry } from './opportunity'

export interface AdminOpportunitySource {
  id: string
  name: string
  indexUrl: string
  active: boolean
  websiteTags: string[]
}
export interface AdminOpportunityOptionsResponse {
  sources: AdminOpportunitySource[]
}
export type OpportunityOrganisationSelection =
  | { existingId: string }
  | { newSource: { name: string; indexUrl: string } }

export interface CreateOpportunityRequest extends Omit<OpportunityResponse, 'id' | 'website' | 'sourceOrg' | 'location' | 'tags'> {
  organisation: OpportunityOrganisationSelection
  /** Source tags; omit to preserve existing tags. Null clears them. */
  tags?: string[] | null
  location?: { label: string; geometry: PointGeometry }
}
