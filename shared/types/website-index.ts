export interface WebsiteIndexResponse {
  id: string
  name: string
  indexUrl: string
  active: boolean
}

export type WebsiteIndexesResponse = WebsiteIndexResponse[]

export interface AdminWebsiteIndex extends WebsiteIndexResponse {
  notes: string | null
}

export type AdminWebsiteIndexesResponse = AdminWebsiteIndex[]

export interface WebsiteIndexUpsertRequest {
  id?: string
  /** Required for existing rows; compare with the last loaded active value. */
  expectedActive?: boolean
  name: string
  indexUrl: string
  active: boolean
  notes: string | null
}

export interface UpdateWebsiteIndexesRequest {
  upserts: WebsiteIndexUpsertRequest[]
  deleteIds: string[]
}
