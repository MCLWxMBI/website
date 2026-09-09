import { createError, defineEventHandler, getRouterParam, setResponseHeader } from 'h3'
import { isStaticPageSlug } from '../../../shared/types/static-page'
import { readStaticPage } from '../../services/static-pages'
import { staticPageRepository } from '../../utils/static-page-repository'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const slug = getRouterParam(event, 'slug')
  if (!isStaticPageSlug(slug)) throw createError({ statusCode: 404, statusMessage: 'Page not found.' })
  return readStaticPage(slug, staticPageRepository)
})
