import { createError } from 'h3'
import type { AdminScraperSourcesResponse, AdminScraperArticlesResponse } from '../../shared/types/admin-scraper'

const MAX_SOURCE_ID = BigInt('9223372036854775807')
export const SCRAPER_PAGE_SIZE = 25
export interface ScraperArticleQuery {
  sourceId: bigint | null
  q: string
  page: number
}
export interface AdminScraperRepository {
  sources(): Promise<AdminScraperSourcesResponse>
  updateSources(updates: ScraperSourceMutation[]): Promise<AdminScraperSourcesResponse>
  articles(query: ScraperArticleQuery): Promise<AdminScraperArticlesResponse | null>
}

const unavailable = () => createError({ statusCode: 503, statusMessage: 'Scraper data is temporarily unavailable. Please try again.' })

export function parseScraperQuery(query: Record<string, unknown>): ScraperArticleQuery {
  const invalid = () => createError({ statusCode: 400, statusMessage: 'Supply a valid source, positive page, and title search of at most 200 characters.' })
  if (typeof query.source !== 'string') throw invalid()
  let sourceId: bigint | null = null
  if (query.source !== 'unassigned') {
    if (!/^[1-9]\d{0,18}$/.test(query.source)) throw invalid()
    sourceId = BigInt(query.source)
    if (sourceId > MAX_SOURCE_ID) throw invalid()
  }
  const page = query.page ?? '1'
  const q = query.q ?? ''
  if (typeof page !== 'string' || !/^[1-9]\d*$/.test(page) || !Number.isSafeInteger(Number(page))) throw invalid()
  if (typeof q !== 'string' || q.length > 200) throw invalid()
  return { sourceId, q: q.trim(), page: Number(page) }
}

export async function readAdminScraperSources(repository: AdminScraperRepository): Promise<AdminScraperSourcesResponse> {
  try { return await repository.sources() } catch { throw unavailable() }
}

export async function readAdminScraperArticles(query: Record<string, unknown>, repository: AdminScraperRepository): Promise<AdminScraperArticlesResponse> {
  const parsed = parseScraperQuery(query)
  let result: AdminScraperArticlesResponse | null
  try { result = await repository.articles(parsed) } catch { throw unavailable() }
  if (!result) throw createError({ statusCode: 404, statusMessage: 'Source not found.' })
  return result
}

export interface ScraperSourceMutation {
  id: bigint
  active: boolean
  expectedActive: boolean
}

export class ScraperSourceConflictError extends Error { }

export function parseScraperSourceUpdates(body: unknown): ScraperSourceMutation[] {
  const invalid = () => createError({ statusCode: 400, statusMessage: 'Supply unique source IDs with boolean active and expectedActive values.' })
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => key !== 'updates')
    || !('updates' in body) || !Array.isArray(body.updates)) throw invalid()
  const seen = new Set<string>()
  return body.updates.map((value: unknown) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.keys(value).some(key => !['id', 'active', 'expectedActive'].includes(key))
      || !('id' in value) || typeof value.id !== 'string' || !/^[1-9]\d{0,18}$/.test(value.id)
      || BigInt(value.id) > MAX_SOURCE_ID || seen.has(value.id)
      || !('active' in value) || typeof value.active !== 'boolean'
      || !('expectedActive' in value) || typeof value.expectedActive !== 'boolean') throw invalid()
    seen.add(value.id)
    return { id: BigInt(value.id), active: value.active, expectedActive: value.expectedActive }
  })
}

export async function saveAdminScraperSources(body: unknown, repository: AdminScraperRepository): Promise<AdminScraperSourcesResponse> {
  const updates = parseScraperSourceUpdates(body)
  try { return await repository.updateSources(updates) } catch (error) {
    if (error instanceof ScraperSourceConflictError) throw createError({
      statusCode: 409, statusMessage: 'A source changed or was deleted. Reload sources before saving again.'
    })
    throw unavailable()
  }
}
