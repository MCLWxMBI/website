import { defineEventHandler, readBody } from 'h3'
import { saveAdminScraperSources } from '../../../services/admin-scraper'
import { requireAdmin } from '../../../utils/require-admin'
import { adminScraperRepository } from '../../../utils/admin-scraper-repository'

export default defineEventHandler(async event => {
  await requireAdmin(event)
  return saveAdminScraperSources(await readBody(event), adminScraperRepository)
})
