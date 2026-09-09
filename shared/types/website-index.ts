export interface WebsiteIndexResponse {
  id: string
  name: string
  indexUrl: string
  active: boolean
}

export type WebsiteIndexesResponse = WebsiteIndexResponse[]
