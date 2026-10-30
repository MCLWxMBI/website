import { defineEventHandler } from 'h3'
import { readAdminOpportunityOptions } from '../../../services/admin-opportunities'
import { requireAdmin } from '../../../utils/require-admin'
import { adminOpportunityRepository } from '../../../utils/admin-opportunity-repository'

export default defineEventHandler(async event => {
  await requireAdmin(event)
  return readAdminOpportunityOptions(adminOpportunityRepository)
})
