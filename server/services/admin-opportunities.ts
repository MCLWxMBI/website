import { randomUUID } from 'node:crypto'
import { createError } from 'h3'
import type { AdminOpportunityOptionsResponse, CreateOpportunityRequest } from '../../shared/types/admin-opportunity'
import type { OpportunityDetailResponse } from '../../shared/types/opportunity'
import { OpportunityValidationError, validateCreateOpportunity } from '../../shared/utils/admin-opportunity'
import type { OpportunityRecord } from '../database/schema'
import { serializeOpportunity } from './opportunities'

export interface AdminOpportunityRepository {
  options(): Promise<AdminOpportunityOptionsResponse>
  create(input: CreateOpportunityRequest, id: string): Promise<{ opportunity: OpportunityRecord; websiteTags: string[] }>
}
export class OpportunityCreateConflict extends Error {
  constructor(message: string, public opportunityId?: string) { super(message) }
}
const unavailable = () => createError({ statusCode: 503, statusMessage: 'Opportunity creation is temporarily unavailable. Please try again.' })
export async function readAdminOpportunityOptions(repository: AdminOpportunityRepository): Promise<AdminOpportunityOptionsResponse> {
  try { return await repository.options() } catch { throw unavailable() }
}
export async function publishAdminOpportunity(body: unknown, repository: AdminOpportunityRepository): Promise<OpportunityDetailResponse> {
  let input: CreateOpportunityRequest
  try { input = validateCreateOpportunity(body) } catch (error) {
    if (error instanceof OpportunityValidationError) throw createError({ statusCode: 400, statusMessage: 'Check the opportunity fields.', data: { fieldErrors: { [error.field]: error.message } } })
    throw createError({ statusCode: 400, statusMessage: 'Supply a valid opportunity.' })
  }
  try {
    const result = await repository.create(input, randomUUID())
    return { opportunity: serializeOpportunity(result.opportunity), websiteTags: result.websiteTags }
  } catch (error) {
    if (error instanceof OpportunityCreateConflict) throw createError({ statusCode: 409, statusMessage: error.message,
      data: error.opportunityId ? { opportunityId: error.opportunityId } : undefined })
    throw unavailable()
  }
}
