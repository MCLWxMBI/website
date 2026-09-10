import { createError } from 'h3'
import type { WebsiteIndex } from '../database/schema'
import type {
  AdminWebsiteIndex,
  AdminWebsiteIndexesResponse
} from '../../shared/types/website-index'

const MAX_BIGINT_ID = BigInt('9223372036854775807')
const REQUEST_KEYS = new Set(['upserts', 'deleteIds'])
const UPSERT_KEYS = new Set(['id', 'name', 'indexUrl', 'active', 'notes'])

export interface WebsiteIndexMutation {
  id?: bigint
  name: string
  indexUrl: string
  active: boolean
  notes: string | null
}

export interface AdminWebsiteIndexRepository {
  all: () => Promise<WebsiteIndex[]>
  applyBatch: (upserts: WebsiteIndexMutation[], deleteIds: bigint[]) => Promise<WebsiteIndex[]>
}

export class WebsiteIndexConflictError extends Error {}

const unavailable = () => createError({
  statusCode: 503,
  statusMessage: 'Website indexes are temporarily unavailable. Please try again.'
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: Set<string>) {
  return Object.keys(value).every(key => allowed.has(key))
}

function parseId(value: unknown): bigint {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    throw new Error('Website index IDs must be positive decimal strings.')
  }
  const id = BigInt(value)
  if (id > MAX_BIGINT_ID) throw new Error('Website index ID is outside the supported range.')
  return id
}

function parseUpsert(value: unknown): WebsiteIndexMutation {
  if (!isRecord(value) || !hasOnlyKeys(value, UPSERT_KEYS)) {
    throw new Error('Each website index must contain only the supported fields.')
  }

  if (typeof value.name !== 'string' || !value.name.trim() || value.name.trim().length > 255) {
    throw new Error('Each website index needs a name of no more than 255 characters.')
  }
  if (typeof value.indexUrl !== 'string') throw new Error('Each website index needs an HTTPS URL.')
  const indexUrl = value.indexUrl.trim()
  try {
    const parsed = new URL(indexUrl)
    if (parsed.protocol !== 'https:') throw new Error()
  } catch {
    throw new Error('Each website index needs a valid absolute HTTPS URL.')
  }
  if (typeof value.active !== 'boolean') throw new Error('Each website index needs an Active status.')
  if (value.notes !== null && typeof value.notes !== 'string') {
    throw new Error('Website index notes must be text or empty.')
  }

  const result: WebsiteIndexMutation = {
    name: value.name.trim(),
    indexUrl,
    active: value.active,
    notes: typeof value.notes === 'string' && value.notes.trim() ? value.notes.trim() : null
  }
  if ('id' in value) result.id = parseId(value.id)
  return result
}

function parseRequest(body: unknown): { upserts: WebsiteIndexMutation[], deleteIds: bigint[] } {
  if (!isRecord(body) || !hasOnlyKeys(body, REQUEST_KEYS) || !Array.isArray(body.upserts) || !Array.isArray(body.deleteIds)) {
    throw new Error('Website index changes must include upserts and deleteIds arrays.')
  }

  const upserts = body.upserts.map(parseUpsert)
  const deleteIds = body.deleteIds.map(parseId)
  const upsertIds = upserts.flatMap(item => item.id === undefined ? [] : [item.id.toString()])
  const deletionIds = deleteIds.map(id => id.toString())
  if (new Set(upsertIds).size !== upsertIds.length || new Set(deletionIds).size !== deletionIds.length) {
    throw new Error('Website index IDs must not be duplicated.')
  }
  if (deletionIds.some(id => upsertIds.includes(id))) {
    throw new Error('A website index cannot be updated and deleted together.')
  }
  return { upserts, deleteIds }
}

function response(rows: WebsiteIndex[]): AdminWebsiteIndexesResponse {
  return rows.map((row): AdminWebsiteIndex => ({
    id: row.id.toString(),
    name: row.name,
    indexUrl: row.indexUrl,
    active: row.active,
    notes: row.notes
  }))
}

export async function readAdminWebsiteIndexes(repository: AdminWebsiteIndexRepository): Promise<AdminWebsiteIndexesResponse> {
  try {
    return response(await repository.all())
  } catch {
    throw unavailable()
  }
}

export async function saveAdminWebsiteIndexes(
  body: unknown,
  repository: AdminWebsiteIndexRepository
): Promise<AdminWebsiteIndexesResponse> {
  let request: { upserts: WebsiteIndexMutation[], deleteIds: bigint[] }
  try {
    request = parseRequest(body)
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage: error instanceof Error ? error.message : 'Website index changes are invalid.'
    })
  }

  try {
    return response(await repository.applyBatch(request.upserts, request.deleteIds))
  } catch (error) {
    if (error instanceof WebsiteIndexConflictError) {
      throw createError({
        statusCode: 409,
        statusMessage: 'A website index changed or was deleted. Reload before trying again.'
      })
    }
    throw unavailable()
  }
}
