import { createError, defineEventHandler, getRouterParam, setResponseHeader } from 'h3'
import { readOpportunity } from '../../services/opportunities'
import { opportunityRepository } from '../../utils/opportunity-repository'

export default defineEventHandler(async event => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const id = getRouterParam(event, 'id')
  if (!id?.trim()) throw createError({ statusCode: 404, statusMessage: 'Opportunity not found.' })
  return readOpportunity(id, opportunityRepository)
})
