import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { publishAdminOpportunity } from '../../../services/admin-opportunities'
import { requireAdmin } from '../../../utils/require-admin'
import { adminOpportunityRepository } from '../../../utils/admin-opportunity-repository'

export default defineEventHandler(async event => {
  await requireAdmin(event)
  const result = await publishAdminOpportunity(await readBody(event), adminOpportunityRepository)
  setResponseStatus(event, 201)
  return result
})
