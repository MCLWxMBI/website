import type { WebsiteIndexResponse } from './website-index'

export interface AdminScraperSource extends WebsiteIndexResponse {
  articleCount: number
}

export interface AdminScraperSourcesResponse {
  sources: AdminScraperSource[]
  unassignedCount: number
}

export interface AdminScraperArticle {
  sourceUrl: string
  title: string
  uploadDate: string | null
  deleted: boolean
  hasSuccessfulScrape: boolean
  opportunityId: string | null
}

export interface AdminScraperArticlesResponse {
  items: AdminScraperArticle[]
  total: number
  page: number
  pageSize: number
}
