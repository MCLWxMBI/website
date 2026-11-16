import { defineEventHandler, getQuery } from 'h3'
import { listAdminOpportunities } from '../../../services/admin-opportunity-management'
import { requireAdmin } from '../../../utils/require-admin'
import { adminOpportunityManagementRepository } from '../../../utils/admin-opportunity-management-repository'

export default defineEventHandler(async event => {
  await requireAdmin(event)
  return listAdminOpportunities(getQuery(event), adminOpportunityManagementRepository)
})
