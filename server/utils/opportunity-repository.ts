import { and, asc, eq, sql } from 'drizzle-orm'
import { effectiveSubmissionDeadline } from './opportunity-deadline-sql'
import { connectDatabase } from '../database'
import { articleHistory, opportunities, websiteIndexes } from '../database/schema'
import type { OpportunityRepository } from '../services/opportunities'

let connection: ReturnType<typeof connectDatabase> | undefined

function database() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required')
  connection ??= connectDatabase(url)
  return connection.db
}

// A deletion marker hides a retained listing from every public read and export.
const published = sql`NOT EXISTS (SELECT 1 FROM ${articleHistory} WHERE ${articleHistory.sourceUrl} = ${opportunities.sourceUrl} AND ${articleHistory.deleted} = TRUE)`

// Inject the connection so handlers and isolated database tests share queries.
export function createOpportunityRepository(db: ReturnType<typeof connectDatabase>['db']) {
  return {
    async allForExport() {
      return db.select({ opportunity: opportunities, sourceName: websiteIndexes.name,
        indexUrl: websiteIndexes.indexUrl, sourceTags: websiteIndexes.tags }).from(opportunities)
        .innerJoin(websiteIndexes, eq(opportunities.websiteId, websiteIndexes.id))
        .where(published)
        .orderBy(asc(effectiveSubmissionDeadline), asc(opportunities.id))
    },
    async all() {
      return db.select({ opportunity: opportunities, websiteTags: websiteIndexes.tags }).from(opportunities)
        .innerJoin(websiteIndexes, eq(opportunities.websiteId, websiteIndexes.id))
        .where(published)
        .orderBy(asc(effectiveSubmissionDeadline), asc(opportunities.id))
    },
    async findDetailById(id: string) {
      const [row] = await db.select({ opportunity: opportunities, websiteTags: websiteIndexes.tags })
        .from(opportunities).innerJoin(websiteIndexes, eq(opportunities.websiteId, websiteIndexes.id))
        .where(and(eq(opportunities.id, id), published)).limit(1)
      return row ?? null
    },
    async findById(id: string) {
      const [row] = await db.select().from(opportunities).where(and(eq(opportunities.id, id), published)).limit(1)
      return row ?? null
    },
    async findWebsiteTags(websiteId: bigint) {
      const [row] = await db.select({ tags: websiteIndexes.tags }).from(websiteIndexes)
        .where(eq(websiteIndexes.id, websiteId)).limit(1)
      return row?.tags ?? null
    }
  }
}

export const opportunityExportRepository = {
  allForExport: () => createOpportunityRepository(database()).allForExport()
}

export const opportunityRepository: OpportunityRepository = {
  all: () => createOpportunityRepository(database()).all(),
  findDetailById: id => createOpportunityRepository(database()).findDetailById(id)
}
