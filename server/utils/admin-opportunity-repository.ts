import { asc, eq, sql } from 'drizzle-orm'
import { connectDatabase } from '../database'
import { articleHistory, opportunities, websiteIndexes, websites } from '../database/schema'
import { toStoredOpportunityDeadline } from '../../shared/utils/opportunity-deadline'
import { OpportunityCreateConflict, type AdminOpportunityRepository } from '../services/admin-opportunities'

type Website = { id: string; tags: string[] }
const internalWebsiteId = (sourceId: bigint) => `source-index:${sourceId}`
function resolveWebsite(sourceId: bigint, associated: Website[], allWebsites: Map<string, Website>): Website {
  const unique = new Map(associated.map(website => [website.id, website]))
  if (unique.size === 1) return unique.values().next().value!
  const id = internalWebsiteId(sourceId)
  return allWebsites.get(id) ?? { id, tags: [] }
}
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
      const [sources, associations, websiteRows] = await Promise.all([
        db.select().from(websiteIndexes).orderBy(asc(sql`lower(${websiteIndexes.name})`), asc(websiteIndexes.id)),
        db.select({ sourceId: articleHistory.sourceIndexId, id: websites.id, tags: websites.tags }).from(articleHistory)
          .innerJoin(opportunities, eq(opportunities.sourceUrl, articleHistory.sourceUrl))
          .innerJoin(websites, eq(websites.id, opportunities.websiteId)),
        db.select().from(websites)
      ])
      const bySource = new Map<bigint, Website[]>()
      for (const association of associations) {
        if (association.sourceId === null) continue
        const entries = bySource.get(association.sourceId) ?? []
        entries.push({ id: association.id, tags: association.tags })
        bySource.set(association.sourceId, entries)
      }
      const allWebsites = new Map(websiteRows.map(website => [website.id, website]))
      return { sources: sources.map(source => ({ id: source.id.toString(), name: source.name, indexUrl: source.indexUrl,
        active: source.active, websiteTags: resolveWebsite(source.id, bySource.get(source.id) ?? [], allWebsites).tags })) }
    },
    create: (input, id) => db.transaction(async tx => {
      let source
      if ('existingId' in input.organisation) {
        // Keep the selected name and source alive until publication commits.
        ;[source] = await tx.select().from(websiteIndexes).where(eq(websiteIndexes.id, BigInt(input.organisation.existingId))).for('share')
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
      const associated = await tx.selectDistinct({ id: websites.id, tags: websites.tags }).from(articleHistory)
        .innerJoin(opportunities, eq(opportunities.sourceUrl, articleHistory.sourceUrl))
        .innerJoin(websites, eq(websites.id, opportunities.websiteId))
        .where(eq(articleHistory.sourceIndexId, source.id))
      const fallbackId = internalWebsiteId(source.id)
      const [fallback] = await tx.select().from(websites).where(eq(websites.id, fallbackId))
      let website = resolveWebsite(source.id, associated, new Map(fallback ? [[fallback.id, fallback]] : []))
      if (associated.length !== 1) {
        await tx.insert(websites).values(website).onConflictDoNothing()
      }
      // Do not overwrite features; lock the resolved record against deletion.
      const [savedWebsite] = await tx.select().from(websites).where(eq(websites.id, website.id)).for('key share')
      if (!savedWebsite) throw new OpportunityCreateConflict('The source website changed. Reload the organisation suggestions.')
      website = savedWebsite
      const [opportunity] = await tx.insert(opportunities).values({
        id, title: input.title, fullText: input.fullText, sourceUrl: input.sourceUrl, websiteId: website.id,
        sourceOrg: source.name, jurisdiction: input.jurisdiction,
        startDate: input.startDate ? new Date(input.startDate) : null,
        ...toStoredOpportunityDeadline(input.submissionDeadline), category: input.category, tags: input.tags,
        summary: input.summary ?? null, location: input.location ?? null
      }).returning()
      // Manual publication is not a successful network scrape: retain hash and date.
      await tx.update(articleHistory).set({ title: input.title, sourceIndexId: source.id }).where(eq(articleHistory.sourceUrl, input.sourceUrl))
      return { opportunity: opportunity!, websiteTags: website.tags }
    })
  }
}
export const adminOpportunityRepository: AdminOpportunityRepository = {
  options: () => createAdminOpportunityRepository(database()).options(),
  create: (input, id) => createAdminOpportunityRepository(database()).create(input, id)
}
