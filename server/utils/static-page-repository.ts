import { eq } from 'drizzle-orm'
import { connectDatabase } from '../database'
import { staticPages } from '../database/schema'
import type { StaticPageRepository } from '../services/static-pages'

let connection: ReturnType<typeof connectDatabase> | undefined

function database() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required')
  connection ??= connectDatabase(url)
  return connection.db
}

export const staticPageRepository: StaticPageRepository = {
  async bySlug(slug) {
    return (await database().select().from(staticPages).where(eq(staticPages.slug, slug)).limit(1))[0]
  },
  async upsert(slug, contentHtml, updatedBy, updatedAt) {
    return (await database().insert(staticPages).values({ slug, contentHtml, updatedBy, updatedAt })
      .onConflictDoUpdate({
        target: staticPages.slug,
        set: { contentHtml, updatedBy, updatedAt }
      }).returning())[0]!
  }
}
