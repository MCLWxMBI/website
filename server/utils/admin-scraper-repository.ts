import { and, asc, count, eq, ilike, inArray, isNull, sql } from 'drizzle-orm'
import { connectDatabase } from '../database'
import { articleHistory, opportunities, websiteIndexes } from '../database/schema'
import { SCRAPER_PAGE_SIZE, ScraperSourceConflictError, type AdminScraperRepository } from '../services/admin-scraper'

let connection: ReturnType<typeof connectDatabase> | undefined
function database() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required')
  connection ??= connectDatabase(url)
  return connection.db
}

type Database = ReturnType<typeof connectDatabase>['db']

async function readSources(tx: Pick<Database, 'select'>) {
  const rows = await tx.select({
    id: websiteIndexes.id, name: websiteIndexes.name, indexUrl: websiteIndexes.indexUrl,
    active: websiteIndexes.active, articleCount: count(articleHistory.sourceUrl)
  }).from(websiteIndexes).leftJoin(articleHistory, eq(articleHistory.sourceIndexId, websiteIndexes.id))
    .groupBy(websiteIndexes.id).orderBy(asc(sql`lower(${websiteIndexes.name})`), asc(websiteIndexes.id))
  const [unassigned] = await tx.select({ total: count() }).from(articleHistory).where(isNull(articleHistory.sourceIndexId))
  return { sources: rows.map(row => ({ ...row, id: row.id.toString() })), unassignedCount: unassigned!.total }
}

export function createAdminScraperRepository(db: Database): AdminScraperRepository {
  return {
    sources: () => db.transaction(readSources, { isolationLevel: 'repeatable read', accessMode: 'read only' }),
    updateSources: updates => db.transaction(async tx => {
      if (updates.length) {
        const rows = await tx.select({ id: websiteIndexes.id, active: websiteIndexes.active })
          .from(websiteIndexes).where(inArray(websiteIndexes.id, updates.map(item => item.id)))
          .orderBy(asc(websiteIndexes.id)).for('update')
        const current = new Map(rows.map(row => [row.id, row.active]))
        if (updates.some(item => current.get(item.id) !== item.expectedActive)) throw new ScraperSourceConflictError()
        for (const item of updates) await tx.update(websiteIndexes).set({ active: item.active }).where(eq(websiteIndexes.id, item.id))
      }
      return readSources(tx)
    }),
    articles: query => db.transaction(async tx => {
      if (query.sourceId !== null) {
        const [source] = await tx.select({ id: websiteIndexes.id }).from(websiteIndexes).where(eq(websiteIndexes.id, query.sourceId))
        if (!source) return null
      }
      // Escape LIKE metacharacters: searches are literal title substrings.
      const pattern = `%${query.q.replace(/[\\%_]/g, '\\$&')}%`
      const where = and(
        query.sourceId === null ? isNull(articleHistory.sourceIndexId) : eq(articleHistory.sourceIndexId, query.sourceId),
        query.q ? ilike(articleHistory.title, pattern) : undefined
      )
      const [result] = await tx.select({ total: count() }).from(articleHistory).where(where)
      const total = result!.total
      const page = Math.min(query.page, Math.max(1, Math.ceil(total / SCRAPER_PAGE_SIZE)))
      const items = await tx.select({
        sourceUrl: articleHistory.sourceUrl, title: articleHistory.title, uploadDate: articleHistory.uploadDate,
        deleted: articleHistory.deleted, hasSuccessfulScrape: sql<boolean>`${articleHistory.hash} IS NOT NULL`,
        opportunityId: opportunities.id
      }).from(articleHistory).leftJoin(opportunities, eq(articleHistory.sourceUrl, opportunities.sourceUrl))
        .where(where).orderBy(sql`${articleHistory.uploadDate} DESC NULLS LAST`, asc(articleHistory.sourceUrl))
        .limit(SCRAPER_PAGE_SIZE).offset((page - 1) * SCRAPER_PAGE_SIZE)
      return { items, total, page, pageSize: SCRAPER_PAGE_SIZE }
    }, { isolationLevel: 'repeatable read', accessMode: 'read only' })
  }
}

export const adminScraperRepository: AdminScraperRepository = {
  sources: () => createAdminScraperRepository(database()).sources(),
  updateSources: updates => createAdminScraperRepository(database()).updateSources(updates),
  articles: query => createAdminScraperRepository(database()).articles(query)
}
