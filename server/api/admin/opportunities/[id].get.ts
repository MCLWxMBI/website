import { defineEventHandler, getRouterParam } from 'h3'
import { readAdminOpportunity } from '../../../services/admin-opportunity-management'
import { requireAdmin } from '../../../utils/require-admin'
import { adminOpportunityManagementRepository } from '../../../utils/admin-opportunity-management-repository'

export default defineEventHandler(async event => {
  await requireAdmin(event)
  return readAdminOpportunity(getRouterParam(event, 'id') ?? '', adminOpportunityManagementRepository)
})
