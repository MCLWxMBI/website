import { asc, eq } from 'drizzle-orm'
import { connectDatabase } from '../database'
import { opportunities, websiteIndexes } from '../database/schema'
import type { OpportunityRepository } from '../services/opportunities'

let connection: ReturnType<typeof connectDatabase> | undefined

function database() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required')
  connection ??= connectDatabase(url)
  return connection.db
}

// Inject the connection so handlers and isolated database tests share queries.
export function createOpportunityRepository(db: ReturnType<typeof connectDatabase>['db']) {
  return {
    async all() {
      return db.select().from(opportunities).orderBy(asc(opportunities.submissionDeadline), asc(opportunities.id))
    },
    async findDetailById(id: string) {
      const [row] = await db.select({ opportunity: opportunities, websiteTags: websiteIndexes.tags })
        .from(opportunities).innerJoin(websiteIndexes, eq(opportunities.websiteId, websiteIndexes.id))
        .where(eq(opportunities.id, id)).limit(1)
      return row ?? null
    },
    async findById(id: string) {
      const [row] = await db.select().from(opportunities).where(eq(opportunities.id, id)).limit(1)
      return row ?? null
    },
    async findWebsiteTags(websiteId: bigint) {
      const [row] = await db.select({ tags: websiteIndexes.tags }).from(websiteIndexes)
        .where(eq(websiteIndexes.id, websiteId)).limit(1)
      return row?.tags ?? null
    }
  }
}

export const opportunityRepository: OpportunityRepository = {
  all: () => createOpportunityRepository(database()).all(),
  findDetailById: id => createOpportunityRepository(database()).findDetailById(id)
}
