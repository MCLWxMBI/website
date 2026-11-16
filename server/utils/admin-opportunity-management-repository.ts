import { createHash } from 'node:crypto'
import { and, asc, count, eq, ilike, sql } from 'drizzle-orm'
import { currentMelbourneUploadDate, effectiveSubmissionDeadline } from './opportunity-deadline-sql'
import { connectDatabase } from '../database'
import { articleHistory, opportunities, websiteIndexes } from '../database/schema'
import type { OpportunityRecord } from '../database/schema'
import { serializeOpportunity } from '../services/opportunities'
import { OpportunityManagementConflict, OpportunityManagementNotFound, type AdminOpportunityManagementRepository } from '../services/admin-opportunity-management'
import { toStoredOpportunityDeadline } from '../../shared/utils/opportunity-deadline'

let connection: ReturnType<typeof connectDatabase> | undefined
function database() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required')
  connection ??= connectDatabase(url)
  return connection.db
}
type Database = ReturnType<typeof connectDatabase>['db']
type Row = { opportunity: OpportunityRecord; websiteTags: string[]; deleted: boolean }
function serialize(row: Row) {
  // A source or history change must also invalidate a stale editor.
  const version = createHash('sha256').update(JSON.stringify({ ...serializeOpportunity(row.opportunity, row.websiteTags), deleted: row.deleted })).digest('hex')
  return { opportunity: serializeOpportunity(row.opportunity, row.websiteTags), websiteTags: row.websiteTags, deleted: row.deleted, version }
}
const selection = { opportunity: opportunities, websiteTags: websiteIndexes.tags, deleted: sql<boolean>`coalesce(${articleHistory.deleted}, false)` }
function read(db: Pick<Database, 'select'>, id: string) {
  return db.select(selection).from(opportunities).innerJoin(websiteIndexes, eq(websiteIndexes.id, opportunities.websiteId))
    .leftJoin(articleHistory, eq(articleHistory.sourceUrl, opportunities.sourceUrl)).where(eq(opportunities.id, id)).limit(1)
}

export function createAdminOpportunityManagementRepository(db: Database): AdminOpportunityManagementRepository {
  async function modify<T>(id: string, version: string, action: (tx: Parameters<Parameters<Database['transaction']>[0]>[0], row: Row) => Promise<T>) {
    return db.transaction(async tx => {
      const [identity] = await tx.select({ sourceUrl: opportunities.sourceUrl, title: opportunities.title, sourceIndexId: opportunities.websiteId }).from(opportunities).where(eq(opportunities.id, id))
      if (!identity) throw new OpportunityManagementNotFound()
      await tx.insert(articleHistory).values({ ...identity, uploadDate: currentMelbourneUploadDate }).onConflictDoNothing()
      // Scraper writes use this same lock first. Keep that ordering before locking the listing.
      await tx.select().from(articleHistory).where(eq(articleHistory.sourceUrl, identity.sourceUrl)).for('update')
      await tx.select().from(opportunities).where(eq(opportunities.id, id)).for('update')
      const [row] = await read(tx, id)
      if (!row) throw new OpportunityManagementNotFound()
      if (row.deleted || serialize(row).version !== version) throw new OpportunityManagementConflict()
      return action(tx, row)
    })
  }
  return {
    list: query => db.transaction(async tx => {
      const now = new Date().toISOString()
      const where = and(
        sql`coalesce(${articleHistory.deleted}, false) = ${query.deleted}`,
        query.q ? ilike(opportunities.title, `%${query.q.replace(/[\\%_]/g, '\\$&')}%`) : undefined,
        query.source === null ? undefined : eq(opportunities.websiteId, query.source),
        query.status === 'closed' ? sql`${effectiveSubmissionDeadline} <= ${now}` :
          query.status === 'upcoming' ? sql`${effectiveSubmissionDeadline} > ${now} AND ${opportunities.startDate} > ${now}` :
            query.status === 'open' ? sql`${effectiveSubmissionDeadline} > ${now} AND (${opportunities.startDate} IS NULL OR ${opportunities.startDate} <= ${now})` : undefined
      )
      const [result] = await tx.select({ total: count() }).from(opportunities)
        .leftJoin(articleHistory, eq(articleHistory.sourceUrl, opportunities.sourceUrl)).where(where)
      const total = result!.total, pageSize = 25, page = Math.min(query.page, Math.max(1, Math.ceil(total / pageSize)))
      const rows = await tx.select(selection).from(opportunities).innerJoin(websiteIndexes, eq(websiteIndexes.id, opportunities.websiteId))
        .leftJoin(articleHistory, eq(articleHistory.sourceUrl, opportunities.sourceUrl)).where(where)
        .orderBy(asc(effectiveSubmissionDeadline), asc(opportunities.id)).limit(pageSize).offset((page - 1) * pageSize)
      return { items: rows.map(serialize), total, page, pageSize }
    }, { isolationLevel: 'repeatable read', accessMode: 'read only' }),
    async detail(id) { const [row] = await read(db, id); return row ? serialize(row) : null },
    update: (id, input) => modify(id, input.expectedVersion, async (tx, row) => {
      await tx.update(opportunities).set({ title: input.title, fullText: input.fullText, summary: input.summary ?? null,
        jurisdiction: input.jurisdiction, startDate: input.startDate ? new Date(input.startDate) : null,
        ...toStoredOpportunityDeadline(input.submissionDeadline), category: input.category,
        ...(input.location === undefined ? {} : { location: input.location }) }).where(eq(opportunities.id, row.opportunity.id))
      // Article history describes scraping, so edits leave its title/hash/date/source untouched.
      const [updated] = await read(tx, id)
      return serialize(updated!)
    }),
    delete: (id, version) => modify(id, version, async (tx, row) => {
      await tx.update(articleHistory).set({ deleted: true }).where(eq(articleHistory.sourceUrl, row.opportunity.sourceUrl))
      // Retain the opportunity itself; public readers must exclude deletion markers.
    })
  }
}
export const adminOpportunityManagementRepository: AdminOpportunityManagementRepository = {
  list: query => createAdminOpportunityManagementRepository(database()).list(query),
  detail: id => createAdminOpportunityManagementRepository(database()).detail(id),
  update: (id, input) => createAdminOpportunityManagementRepository(database()).update(id, input),
  delete: (id, version) => createAdminOpportunityManagementRepository(database()).delete(id, version)
}
