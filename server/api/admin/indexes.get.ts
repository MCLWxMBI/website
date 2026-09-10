import { defineEventHandler } from 'h3'
import { readAdminWebsiteIndexes } from '../../services/admin-website-indexes'
import { requireAdmin } from '../../utils/require-admin'
import { adminWebsiteIndexRepository } from '../../utils/website-index-repository'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return readAdminWebsiteIndexes(adminWebsiteIndexRepository)
})
