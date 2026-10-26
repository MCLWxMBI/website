import { defineEventHandler } from 'h3'
import { readAdminScraperSources } from '../../../services/admin-scraper'
import { requireAdmin } from '../../../utils/require-admin'
import { adminScraperRepository } from '../../../utils/admin-scraper-repository'

export default defineEventHandler(async event => {
  await requireAdmin(event)
  return readAdminScraperSources(adminScraperRepository)
})
