export { jurisdictions, opportunityCategories, opportunityStatuses } from '~~/shared/types/opportunity'
export type {
  GeoPosition,
  Jurisdiction,
  MultiPolygonGeometry,
  Opportunity,
  OpportunityCategory,
  OpportunityLocation,
  OpportunityResponse,
  OpportunityStatus,
  OpportunityWithStatus,
  PointGeometry,
  PolygonGeometry
} from '~~/shared/types/opportunity'

// Known prototype websites; persistence supports additional website IDs.
export const websiteKeys = ['engage-victoria', 'dcceew-consult'] as const
export type WebsiteKey = typeof websiteKeys[number]
