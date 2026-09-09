import { asc, sql } from 'drizzle-orm'
import { connectDatabase } from '../database'
import { websiteIndexes } from '../database/schema'
import type { WebsiteIndexRepository } from '../services/website-indexes'

let connection: ReturnType<typeof connectDatabase> | undefined

function database() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required')
  connection ??= connectDatabase(url)
  return connection.db
}

export function createWebsiteIndexRepository(
  db: ReturnType<typeof connectDatabase>['db']
): WebsiteIndexRepository {
  return {
    async all() {
      return db
        .select({
          id: websiteIndexes.id,
          name: websiteIndexes.name,
          indexUrl: websiteIndexes.indexUrl,
          active: websiteIndexes.active
        })
        .from(websiteIndexes)
        .orderBy(asc(sql`lower(${websiteIndexes.name})`), asc(websiteIndexes.id))
    }
  }
}

export const websiteIndexRepository: WebsiteIndexRepository = {
  all: () => createWebsiteIndexRepository(database()).all()
}
