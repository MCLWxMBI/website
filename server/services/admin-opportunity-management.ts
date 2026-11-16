import { createError } from 'h3'
import type { AdminOpportunityDetail, AdminOpportunityList, UpdateOpportunityRequest } from '../../shared/types/admin-opportunity-management'
import { OpportunityValidationError } from '../../shared/utils/admin-opportunity'
import { validateOpportunityVersion, validateUpdateOpportunity } from '../../shared/utils/admin-opportunity-management'

export interface AdminOpportunityQuery {
  q: string
  source: bigint | null
  status: 'all' | 'upcoming' | 'open' | 'closed'
  deleted: boolean
  page: number
}
export interface AdminOpportunityManagementRepository {
  list(query: AdminOpportunityQuery): Promise<AdminOpportunityList>
  detail(id: string): Promise<AdminOpportunityDetail | null>
  update(id: string, input: UpdateOpportunityRequest): Promise<AdminOpportunityDetail>
  delete(id: string, expectedVersion: string): Promise<void>
}
export class OpportunityManagementConflict extends Error {}
export class OpportunityManagementNotFound extends Error {}

async function databaseAction<T>(action: () => Promise<T>): Promise<T> {
  try { return await action() } catch (error) {
    if (error instanceof OpportunityManagementConflict) throw createError({ statusCode: 409, statusMessage: 'This listing changed or was deleted. Reload it before trying again.' })
    if (error instanceof OpportunityManagementNotFound) throw createError({ statusCode: 404, statusMessage: 'Opportunity not found.' })
    throw createError({ statusCode: 503, statusMessage: 'Opportunity management is temporarily unavailable. Please try again.' })
  }
}
function validate<T>(action: () => T): T {
  try { return action() } catch (error) {
    throw createError({ statusCode: 400, statusMessage: 'Check the opportunity fields.',
      data: { fieldErrors: { [error instanceof OpportunityValidationError ? error.field : 'form']: error instanceof OpportunityValidationError ? error.message : 'Invalid request.' } } })
  }
}
export async function listAdminOpportunities(query: Record<string, unknown>, repository: AdminOpportunityManagementRepository) {
  const parsed = validate((): AdminOpportunityQuery => {
    const q = query.q ?? '', source = query.source ?? '', status = query.status ?? 'all', deleted = query.deleted ?? 'false', page = query.page ?? '1'
    if (typeof q !== 'string' || q.length > 200 || typeof source !== 'string'
      || (source !== '' && (!/^[1-9]\d*$/.test(source) || BigInt(source) > 9223372036854775807n))
      || !['all', 'upcoming', 'open', 'closed'].includes(status as string) || typeof status !== 'string'
      || !['true', 'false'].includes(deleted as string) || typeof deleted !== 'string'
      || typeof page !== 'string' || !/^[1-9]\d*$/.test(page) || !Number.isSafeInteger(Number(page))) throw new Error('Invalid filters')
    return { q: q.trim(), source: source ? BigInt(source) : null, status: status as AdminOpportunityQuery['status'], deleted: deleted === 'true', page: Number(page) }
  })
  return databaseAction(() => repository.list(parsed))
}
export async function readAdminOpportunity(id: string, repository: AdminOpportunityManagementRepository) {
  return databaseAction(async () => {
    const detail = await repository.detail(id)
    if (!detail) throw new OpportunityManagementNotFound()
    return detail
  })
}
export async function updateAdminOpportunity(id: string, body: unknown, repository: AdminOpportunityManagementRepository) {
  const input = validate(() => validateUpdateOpportunity(body))
  return databaseAction(() => repository.update(id, input))
}
export async function deleteAdminOpportunity(id: string, body: unknown, repository: AdminOpportunityManagementRepository) {
  const version = validate(() => {
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => key !== 'expectedVersion')) throw new Error('Invalid request')
    return validateOpportunityVersion((body as Record<string, unknown>).expectedVersion)
  })
  await databaseAction(() => repository.delete(id, version))
  return { deleted: true }
}
