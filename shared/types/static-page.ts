export const STATIC_PAGE_SLUGS = ['about', 'resources'] as const

export type StaticPageSlug = typeof STATIC_PAGE_SLUGS[number]

export interface StoredStaticPageResponse {
  slug: StaticPageSlug
  exists: true
  contentHtml: string
  updatedAt: string
}

export interface MissingStaticPageResponse {
  slug: StaticPageSlug
  exists: false
  contentHtml: null
  updatedAt: null
}

export type StaticPageResponse = StoredStaticPageResponse | MissingStaticPageResponse

export interface UpdateStaticPageRequest {
  contentHtml: string
}

export function isStaticPageSlug(value: unknown): value is StaticPageSlug {
  return typeof value === 'string' && STATIC_PAGE_SLUGS.includes(value as StaticPageSlug)
}
