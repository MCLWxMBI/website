import { defineEventHandler, getRouterParam } from 'h3'
import { requireAdmin } from '../../../../utils/require-admin'
import { scraperRunsRepository } from '../../../../utils/admin-scraper-runs-repository'
import { readScraperRun } from '../../../../services/admin-scraper-runs'

export default defineEventHandler(async event => {
  await requireAdmin(event)
  return readScraperRun(getRouterParam(event, 'id'), scraperRunsRepository)
})
