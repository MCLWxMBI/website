import { defineEventHandler, getQuery } from 'h3'
import { readAdminScraperArticles } from '../../../services/admin-scraper'
import { requireAdmin } from '../../../utils/require-admin'
import { adminScraperRepository } from '../../../utils/admin-scraper-repository'

export default defineEventHandler(async event => {
  await requireAdmin(event)
  return readAdminScraperArticles(getQuery(event), adminScraperRepository)
})
