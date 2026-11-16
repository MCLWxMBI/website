import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { updateAdminOpportunity } from '../../../services/admin-opportunity-management'
import { requireAdmin } from '../../../utils/require-admin'
import { adminOpportunityManagementRepository } from '../../../utils/admin-opportunity-management-repository'

export default defineEventHandler(async event => {
  await requireAdmin(event)
  return updateAdminOpportunity(getRouterParam(event, 'id') ?? '', await readBody(event), adminOpportunityManagementRepository)
})
