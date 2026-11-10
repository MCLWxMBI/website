import { count, desc, eq, sql, type SQLWrapper } from 'drizzle-orm'
import { connectDatabase } from '../database'
import { scraperRuns } from '../database/schema'
import { SCRAPER_RUN_PAGE_SIZE, type ScraperRunsRepository } from '../services/admin-scraper-runs'

let connection: ReturnType<typeof connectDatabase> | undefined
function database() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required')
  connection ??= connectDatabase(url)
  return connection.db
}

// Keep bigint source IDs exact even when they are JSON numbers in storage.
function jsonWithTextIds(column: SQLWrapper) {
  return sql<unknown>`CASE WHEN jsonb_typeof(${column}) = 'array' THEN COALESCE((
    SELECT jsonb_agg(CASE WHEN jsonb_typeof(entry) = 'object'
      THEN entry || jsonb_build_object('website_index_id', entry ->> 'website_index_id') ELSE entry END ORDER BY position)
    FROM jsonb_array_elements(${column}) WITH ORDINALITY AS entries(entry, position)
  ), '[]'::jsonb) ELSE ${column} END`
}

const fields = {
  id: scraperRuns.id, startedAt: scraperRuns.startedAt, finishedAt: scraperRuns.finishedAt,
  status: scraperRuns.status, sources: jsonWithTextIds(scraperRuns.sources)
}

export function createScraperRunsRepository(db: ReturnType<typeof connectDatabase>['db']): ScraperRunsRepository {
  return {
    list: query => db.transaction(async tx => {
      const where = query.status ? eq(scraperRuns.status, query.status) : undefined
      const [result] = await tx.select({ total: count() }).from(scraperRuns).where(where)
      const total = result!.total
      const page = Math.min(query.page, Math.max(1, Math.ceil(total / SCRAPER_RUN_PAGE_SIZE)))
      const rows = await tx.select(fields).from(scraperRuns).where(where)
        .orderBy(desc(scraperRuns.startedAt), desc(scraperRuns.id)).limit(SCRAPER_RUN_PAGE_SIZE).offset((page - 1) * SCRAPER_RUN_PAGE_SIZE)
      return { rows, total, page }
    }, { isolationLevel: 'repeatable read', accessMode: 'read only' }),
    async detail(id) {
      const [row] = await db.select({ ...fields, extractedOpportunities: jsonWithTextIds(scraperRuns.extractedOpportunities) })
        .from(scraperRuns).where(eq(scraperRuns.id, id)).limit(1)
      return row ?? null
    }
  }
}

export const scraperRunsRepository: ScraperRunsRepository = {
  list: query => createScraperRunsRepository(database()).list(query),
  detail: id => createScraperRunsRepository(database()).detail(id)
}
