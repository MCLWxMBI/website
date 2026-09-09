import { createError } from 'h3'
import type { StaticPage } from '../database/schema'
import type { StaticPageResponse, StaticPageSlug } from '../../shared/types/static-page'
import { sanitizeStaticPageHtml, validateStaticPageHtml } from '../../shared/utils/static-page-content'

export interface StaticPageRepository {
  bySlug: (slug: StaticPageSlug) => Promise<StaticPage | undefined>
  upsert: (slug: StaticPageSlug, contentHtml: string, updatedBy: number, updatedAt: Date) => Promise<StaticPage>
}

const unavailable = () => createError({
  statusCode: 503,
  statusMessage: 'Page content is temporarily unavailable. Please try again.'
})

function response(slug: StaticPageSlug, page?: StaticPage): StaticPageResponse {
  if (!page) return { slug, exists: false, contentHtml: null, updatedAt: null }
  return {
    slug,
    exists: true,
    contentHtml: sanitizeStaticPageHtml(page.contentHtml),
    updatedAt: page.updatedAt.toISOString()
  }
}

export async function readStaticPage(slug: StaticPageSlug, repository: StaticPageRepository): Promise<StaticPageResponse> {
  try {
    return response(slug, await repository.bySlug(slug))
  } catch {
    throw unavailable()
  }
}

export async function saveStaticPage(
  slug: StaticPageSlug,
  body: unknown,
  updatedBy: number,
  repository: StaticPageRepository,
  now = new Date()
): Promise<StaticPageResponse> {
  if (!body || typeof body !== 'object' || !('contentHtml' in body)) {
    throw createError({ statusCode: 400, statusMessage: 'Page content is required.' })
  }

  let contentHtml: string
  try {
    contentHtml = validateStaticPageHtml(body.contentHtml)
  } catch (error) {
    throw createError({ statusCode: 400, statusMessage: error instanceof Error ? error.message : 'Page content is invalid.' })
  }

  try {
    return response(slug, await repository.upsert(slug, contentHtml, updatedBy, now))
  } catch {
    throw unavailable()
  }
}
