import { defineEventHandler, getQuery } from 'h3'
import { requireAdmin } from '../../../../utils/require-admin'
import { scraperRunsRepository } from '../../../../utils/admin-scraper-runs-repository'
import { listScraperRuns } from '../../../../services/admin-scraper-runs'

export default defineEventHandler(async event => {
  await requireAdmin(event)
  return listScraperRuns(getQuery(event), scraperRunsRepository)
})
