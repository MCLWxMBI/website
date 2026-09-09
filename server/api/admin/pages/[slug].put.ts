import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { isStaticPageSlug } from '../../../../shared/types/static-page'
import { saveStaticPage } from '../../../services/static-pages'
import { requireAdmin } from '../../../utils/require-admin'
import { staticPageRepository } from '../../../utils/static-page-repository'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!isStaticPageSlug(slug)) throw createError({ statusCode: 404, statusMessage: 'Page not found.' })
  const session = await requireAdmin(event)
  return saveStaticPage(slug, await readBody(event), session.user.id, staticPageRepository)
})
