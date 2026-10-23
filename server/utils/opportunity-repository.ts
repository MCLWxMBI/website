import { eq } from 'drizzle-orm'
import type { connectDatabase } from '../database'
import { opportunities, websites } from '../database/schema'

// Inject the connection so future handlers and database tests share this boundary.
export function createOpportunityRepository(db: ReturnType<typeof connectDatabase>['db']) {
  return {
    async findById(id: string) {
      const [row] = await db.select().from(opportunities).where(eq(opportunities.id, id)).limit(1)
      return row ?? null
    },
    async findWebsiteTags(websiteId: string) {
      const [row] = await db.select({ tags: websites.tags }).from(websites)
        .where(eq(websites.id, websiteId)).limit(1)
      return row?.tags ?? null
    }
  }
}
