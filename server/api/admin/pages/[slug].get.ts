import { createError, defineEventHandler, getRouterParam } from 'h3'
import { isStaticPageSlug } from '../../../../shared/types/static-page'
import { readStaticPage } from '../../../services/static-pages'
import { requireAdmin } from '../../../utils/require-admin'
import { staticPageRepository } from '../../../utils/static-page-repository'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!isStaticPageSlug(slug)) throw createError({ statusCode: 404, statusMessage: 'Page not found.' })
  await requireAdmin(event)
  return readStaticPage(slug, staticPageRepository)
})
