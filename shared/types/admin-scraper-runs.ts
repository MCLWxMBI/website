export const scraperRunStatuses = ['running', 'passed', 'failed', 'interrupted'] as const
export type ScraperRunStatus = typeof scraperRunStatuses[number]
export const scraperSourceStatuses = ['passed', 'failed', 'empty', 'skipped'] as const
export type ScraperSourceStatus = typeof scraperSourceStatuses[number]

export interface ScraperRunCounts {
  discoveredCount: number
  processedCount: number
  passedCount: number
  invalidCount: number
  failedCount: number
  skippedCount: number
}

export interface ScraperRunSource extends ScraperRunCounts {
  websiteIndexId: string
  sourceName: string
  sourceUrl: string
  status: ScraperSourceStatus
  error: string | null
}

export interface ScraperRunSummary {
  id: string
  startedAt: string
  finishedAt: string | null
  status: ScraperRunStatus
  sourceCount: number
  totals: ScraperRunCounts
}

export interface ScraperRunsResponse {
  items: ScraperRunSummary[]
  total: number
  page: number
  pageSize: number
}

export interface ScraperRunDetail extends ScraperRunSummary {
  sources: ScraperRunSource[]
  extractedOpportunities: { websiteIndexId: string; sourceName: string; titles: string[] }[]
}
