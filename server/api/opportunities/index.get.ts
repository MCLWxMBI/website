import { defineEventHandler, setResponseHeader } from 'h3'
import { listOpportunities } from '../../services/opportunities'
import { opportunityRepository } from '../../utils/opportunity-repository'

export default defineEventHandler(async event => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return listOpportunities(opportunityRepository)
})
