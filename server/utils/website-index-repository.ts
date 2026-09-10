import { asc, eq, inArray, sql } from 'drizzle-orm'
import { connectDatabase } from '../database'
import { websiteIndexes } from '../database/schema'
import {
  WebsiteIndexConflictError,
  type AdminWebsiteIndexRepository
} from '../services/admin-website-indexes'
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

function orderedAdminIndexes(db: ReturnType<typeof connectDatabase>['db']) {
  return db.select().from(websiteIndexes)
    .orderBy(asc(sql`lower(${websiteIndexes.name})`), asc(websiteIndexes.id))
}

export function createAdminWebsiteIndexRepository(
  db: ReturnType<typeof connectDatabase>['db']
): AdminWebsiteIndexRepository {
  return {
    all: () => orderedAdminIndexes(db),
    async applyBatch(upserts, deleteIds) {
      return db.transaction(async (tx) => {
        const expectedIds = [...upserts.flatMap(item => item.id === undefined ? [] : [item.id]), ...deleteIds]
        if (expectedIds.length) {
          const existing = await tx.select({ id: websiteIndexes.id })
            .from(websiteIndexes)
            .where(inArray(websiteIndexes.id, expectedIds))
          if (existing.length !== expectedIds.length) throw new WebsiteIndexConflictError()
        }

        for (const item of upserts) {
          const values = {
            name: item.name,
            indexUrl: item.indexUrl,
            active: item.active,
            notes: item.notes
          }
          if (item.id === undefined) {
            await tx.insert(websiteIndexes).values(values)
          } else {
            await tx.update(websiteIndexes).set(values).where(eq(websiteIndexes.id, item.id))
          }
        }
        if (deleteIds.length) await tx.delete(websiteIndexes).where(inArray(websiteIndexes.id, deleteIds))

        return tx.select().from(websiteIndexes)
          .orderBy(asc(sql`lower(${websiteIndexes.name})`), asc(websiteIndexes.id))
      })
    }
  }
}

export const adminWebsiteIndexRepository: AdminWebsiteIndexRepository = {
  all: () => createAdminWebsiteIndexRepository(database()).all(),
  applyBatch: (upserts, deleteIds) => createAdminWebsiteIndexRepository(database()).applyBatch(upserts, deleteIds)
}
