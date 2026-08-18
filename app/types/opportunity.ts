export const opportunityStatuses = ['open', 'upcoming', 'closed'] as const
export type OpportunityStatus = typeof opportunityStatuses[number]

export const jurisdictions = ['Commonwealth', 'Victoria'] as const
export type Jurisdiction = typeof jurisdictions[number]

export const opportunityCategories = [
  'Biodiversity & ecosystems',
  'Climate change',
  'First Nations & cultural heritage',
  'Water & resources',
  'Communities & environment'
] as const
export type OpportunityCategory = typeof opportunityCategories[number]

export type GeoPosition = [longitude: number, latitude: number]

export interface PointGeometry {
  type: 'Point'
  coordinates: GeoPosition
}

export interface PolygonGeometry {
  type: 'Polygon'
  coordinates: GeoPosition[][]
}

export interface MultiPolygonGeometry {
  type: 'MultiPolygon'
  coordinates: GeoPosition[][][]
}

export interface OpportunityLocation {
  label: string
  geometry: PointGeometry | PolygonGeometry | MultiPolygonGeometry
}

export interface Opportunity {
  id: string
  title: string
  summary: string
  fullText: string[]
  sourceUrl: string
  sourceOrg: string
  jurisdiction: Jurisdiction
  openDate: string
  closeDate: string
  tags: OpportunityCategory[]
  status: OpportunityStatus
  location?: OpportunityLocation
}
