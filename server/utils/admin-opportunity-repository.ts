import { asc, eq, sql } from 'drizzle-orm'
import { connectDatabase } from '../database'
import { articleHistory, opportunities, websiteIndexes } from '../database/schema'
import { toStoredOpportunityDeadline } from '../../shared/utils/opportunity-deadline'
import { OpportunityCreateConflict, type AdminOpportunityRepository } from '../services/admin-opportunities'

let connection: ReturnType<typeof connectDatabase> | undefined
function database() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required')
  connection ??= connectDatabase(url)
  return connection.db
}
export function createAdminOpportunityRepository(db: ReturnType<typeof connectDatabase>['db']): AdminOpportunityRepository {
  return {
    async options() {
      const sources = await db.select().from(websiteIndexes)
        .orderBy(asc(sql`lower(${websiteIndexes.name})`), asc(websiteIndexes.id))
      return { sources: sources.map(source => ({ id: source.id.toString(), name: source.name, indexUrl: source.indexUrl,
        active: source.active, websiteTags: source.tags })) }
    },
    create: (input, id) => db.transaction(async tx => {
      let source
      if ('existingId' in input.organisation) {
        // Keep the selected name and source alive until publication commits.
        ;[source] = await tx.select().from(websiteIndexes).where(eq(websiteIndexes.id, BigInt(input.organisation.existingId))).for('update')
        if (!source) throw new OpportunityCreateConflict('The selected organisation no longer exists. Reload the organisation suggestions.')
      } else {
        ;[source] = await tx.insert(websiteIndexes).values({ ...input.organisation.newSource, active: false, notes: null }).returning()
      }
      if (!source) throw new Error('Source creation did not return a record.')
      // Preserve the scraper's history-first identity lock and deletion rules.
      await tx.insert(articleHistory).values({ sourceUrl: input.sourceUrl, title: input.title }).onConflictDoNothing()
      const [history] = await tx.select().from(articleHistory).where(eq(articleHistory.sourceUrl, input.sourceUrl)).for('update')
      if (!history || history.deleted) throw new OpportunityCreateConflict('This consultation URL was previously deleted and cannot be recreated here.')
      const [existing] = await tx.select({ id: opportunities.id }).from(opportunities).where(eq(opportunities.sourceUrl, input.sourceUrl))
      if (existing) throw new OpportunityCreateConflict('An opportunity already uses this consultation URL.', existing.id)
      if (history.sourceIndexId !== null && history.sourceIndexId !== source.id) {
        throw new OpportunityCreateConflict('This consultation URL is already linked to a different source. Select that source before publishing.')
      }
      const websiteTags = input.tags === undefined ? source.tags : input.tags ?? []
      if (input.tags !== undefined) {
        await tx.update(websiteIndexes).set({ tags: websiteTags }).where(eq(websiteIndexes.id, source.id))
      }
      const [opportunity] = await tx.insert(opportunities).values({
        id, title: input.title, fullText: input.fullText, sourceUrl: input.sourceUrl, websiteId: source.id,
        sourceOrg: source.name, jurisdiction: input.jurisdiction,
        startDate: input.startDate ? new Date(input.startDate) : null,
        ...toStoredOpportunityDeadline(input.submissionDeadline), category: input.category,
        summary: input.summary ?? null, location: input.location ?? null
      }).returning()
      // Manual publication is not a successful network scrape: retain hash and date.
      await tx.update(articleHistory).set({ title: input.title, sourceIndexId: source.id }).where(eq(articleHistory.sourceUrl, input.sourceUrl))
      return { opportunity: opportunity!, websiteTags }
    })
  }
}
export const adminOpportunityRepository: AdminOpportunityRepository = {
  options: () => createAdminOpportunityRepository(database()).options(),
  create: (input, id) => createAdminOpportunityRepository(database()).create(input, id)
}
