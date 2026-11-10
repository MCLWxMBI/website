import { createError } from 'h3'
import { scraperRunStatuses, scraperSourceStatuses } from '../../shared/types/admin-scraper-runs'
import type { ScraperRunCounts, ScraperRunDetail, ScraperRunSource, ScraperRunStatus,
  ScraperRunsResponse, ScraperRunSummary } from '../../shared/types/admin-scraper-runs'

export const SCRAPER_RUN_PAGE_SIZE = 25
export interface RunQuery { status?: ScraperRunStatus; page: number }
export interface StoredRun {
  id: bigint
  startedAt: Date
  finishedAt: Date | null
  status: string
  sources: unknown
}
export interface ScraperRunsRepository {
  list(query: RunQuery): Promise<{ rows: StoredRun[]; total: number; page: number }>
  detail(id: bigint): Promise<(StoredRun & { extractedOpportunities: unknown }) | null>
}

export function parseRunId(value: unknown): bigint {
  if (typeof value !== 'string' || !/^[1-9]\d{0,18}$/.test(value) || BigInt(value) > BigInt('9223372036854775807')) {
    throw createError({ statusCode: 400, statusMessage: 'Supply a valid run ID.' })
  }
  return BigInt(value)
}

export function parseRunQuery(query: Record<string, unknown>): RunQuery {
  const page = query.page ?? '1'
  const status = query.status
  if (typeof page !== 'string' || !/^[1-9]\d*$/.test(page) || !Number.isSafeInteger(Number(page))
    || (status !== undefined && (typeof status !== 'string' || !scraperRunStatuses.includes(status as ScraperRunStatus)))) {
    throw createError({ statusCode: 400, statusMessage: 'Supply a valid run status and positive page.' })
  }
  return { page: Number(page), ...(status === undefined ? {} : { status: status as ScraperRunStatus }) }
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid log object')
  return value as Record<string, unknown>
}
function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Invalid log text')
  return value
}
function count(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('Invalid log count')
  return value
}
function sourceId(value: unknown): string {
  // The repository converts JSON IDs to strings in SQL before JS can round them.
  if (typeof value !== 'string') throw new Error('Invalid source ID')
  return parseRunId(value).toString()
}
function sources(value: unknown): ScraperRunSource[] {
  if (!Array.isArray(value)) throw new Error('Invalid source results')
  const seen = new Set<string>()
  return value.map(entry => {
    const row = object(entry)
    const websiteIndexId = sourceId(row.website_index_id)
    if (seen.has(websiteIndexId) || !scraperSourceStatuses.includes(row.status as ScraperRunSource['status'])
      || !(row.error === null || typeof row.error === 'string')) throw new Error('Invalid source result')
    seen.add(websiteIndexId)
    const counts = {
      discoveredCount: count(row.discovered_count), processedCount: count(row.processed_count),
      passedCount: count(row.passed_count), invalidCount: count(row.invalid_count),
      failedCount: count(row.failed_count), skippedCount: count(row.skipped_count)
    }
    if (counts.processedCount !== counts.passedCount + counts.invalidCount + counts.failedCount) throw new Error('Invalid processed count')
    return { ...counts, websiteIndexId, sourceName: text(row.source_name), sourceUrl: text(row.source_url),
      status: row.status as ScraperRunSource['status'], error: row.error as string | null }
  })
}

function summary(row: StoredRun, results: ScraperRunSource[]): ScraperRunSummary {
  if (!scraperRunStatuses.includes(row.status as ScraperRunStatus)) throw new Error('Invalid run status')
  const totals: ScraperRunCounts = { discoveredCount: 0, processedCount: 0, passedCount: 0,
    invalidCount: 0, failedCount: 0, skippedCount: 0 }
  for (const result of results) for (const key of Object.keys(totals) as (keyof ScraperRunCounts)[]) {
    totals[key] = count(totals[key] + result[key])
  }
  return { id: row.id.toString(), startedAt: row.startedAt.toISOString(), finishedAt: row.finishedAt?.toISOString() ?? null,
    status: row.status as ScraperRunStatus, sourceCount: results.length, totals }
}

const unavailable = () => createError({ statusCode: 503, statusMessage: 'Scraper run logs are temporarily unavailable. Please try again.' })

export async function listScraperRuns(query: Record<string, unknown>, repository: ScraperRunsRepository): Promise<ScraperRunsResponse> {
  const parsed = parseRunQuery(query)
  try {
    const { rows, total, page } = await repository.list(parsed)
    return { items: rows.map(row => summary(row, sources(row.sources))), total, page, pageSize: SCRAPER_RUN_PAGE_SIZE }
  } catch { throw unavailable() }
}

export async function readScraperRun(id: unknown, repository: ScraperRunsRepository): Promise<ScraperRunDetail> {
  const parsed = parseRunId(id)
  let row: Awaited<ReturnType<ScraperRunsRepository['detail']>>
  try { row = await repository.detail(parsed) } catch { throw unavailable() }
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Scraper run not found.' })
  try {
    const results = sources(row.sources)
    if (!Array.isArray(row.extractedOpportunities)) throw new Error('Invalid extracted opportunities')
    const seen = new Set<string>()
    const extractedOpportunities = row.extractedOpportunities.map(entry => {
      const value = object(entry)
      const websiteIndexId = sourceId(value.website_index_id)
      const result = results.find(source => source.websiteIndexId === websiteIndexId)
      if (!result || seen.has(websiteIndexId) || !Array.isArray(value.titles)
        || value.titles.length !== result.passedCount || text(value.source_name) !== result.sourceName) throw new Error('Invalid saved titles')
      seen.add(websiteIndexId)
      return { websiteIndexId, sourceName: result.sourceName, titles: value.titles.map(text) }
    })
    if (seen.size !== results.length) throw new Error('Missing title group')
    return { ...summary(row, results), sources: results, extractedOpportunities }
  } catch { throw unavailable() }
}
