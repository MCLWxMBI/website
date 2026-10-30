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

export interface CreateOpportunityRequest extends Omit<OpportunityResponse, 'id' | 'website' | 'sourceOrg' | 'location'> {
  organisation: OpportunityOrganisationSelection
  location?: { label: string; geometry: PointGeometry }
}
