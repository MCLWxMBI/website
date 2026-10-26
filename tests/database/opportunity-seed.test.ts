import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import postgres from 'postgres'
import { eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { connectDatabase } from '../../server/database'
import { articleHistory, opportunities, websites } from '../../server/database/schema'
import { createOpportunityRepository } from '../../server/utils/opportunity-repository'
import { listOpportunities, readOpportunity } from '../../server/services/opportunities'
import { seedDatabase } from '../../scripts/seed-database'

const databaseUrl = process.env.TEST_DATABASE_URL
if (!databaseUrl) throw new Error('Run npm run test:database and select an environment file.')

describe('development SQL seed and database catalogue', () => {
  const databaseName = `echo_seed_test_${randomUUID().replaceAll('-', '')}`
  let admin: ReturnType<typeof postgres>
  let connection: ReturnType<typeof connectDatabase>
  let created = false

  beforeAll(async () => {
    admin = postgres(databaseUrl, { max: 1, connect_timeout: 5, onnotice: () => {} })
    await admin.unsafe(`CREATE DATABASE "${databaseName}" TEMPLATE template0`)
    created = true
    const url = new URL(databaseUrl)
    url.pathname = `/${databaseName}`
    connection = connectDatabase(url.toString())
    await migrate(connection.db, { migrationsFolder: './drizzle' })
  })

  beforeEach(async () => {
    // This connection points only to the randomly named test database above.
    await connection.client`TRUNCATE opportunities, article_history, websites`
  })

  afterAll(async () => {
    if (connection) await connection.client.end({ timeout: 5 })
    if (created) await admin.unsafe(`DROP DATABASE "${databaseName}"`)
    if (admin) await admin.end({ timeout: 5 })
  })

  it('persists all 12 opportunities, website features, map geometries, and linked scrape histories', async () => {
    expect(await seedDatabase(connection.client)).toEqual({ seeded: 12, skipped: 0, history: 12 })
    const rows = await connection.db.select().from(opportunities)
    expect(rows).toHaveLength(12)
    expect(new Set(rows.map(row => row.sourceUrl)).size).toBe(12)
    expect(rows.filter(row => row.tags?.includes('Invite-only'))).toHaveLength(3)
    expect(rows.filter(row => row.location).map(row => row.location!.geometry.type).sort())
      .toEqual(['MultiPolygon', 'Point', 'Polygon'])
    for (const row of rows) {
      const prefix = row.websiteId === 'engage-victoria'
        ? 'https://engage.vic.gov.au/project/placeholder-'
        : 'https://consult.dcceew.gov.au/find-consultations/placeholder-'
      expect(row.sourceUrl).toBe(prefix + row.id)
      expect(row.fullText).toHaveLength(2)
    }
    const histories = await connection.db.select().from(articleHistory)
    expect(histories).toHaveLength(12)
    for (const history of histories) {
      expect(history.title).toBe(rows.find(row => row.sourceUrl === history.sourceUrl)?.title)
      expect(history.deleted).toBe(false)
      expect(history.hash).toMatch(/^[0-9a-f]{64}$/)
      expect(history.uploadDate).toMatch(/^2026-\d{2}-\d{2}$/)
    }
    expect(await connection.db.select().from(websites)).toHaveLength(2)
    const repository = createOpportunityRepository(connection.db)
    expect(await repository.findWebsiteTags('engage-victoria')).toEqual(['Login required', 'Online submission'])
    expect(await repository.findWebsiteTags('dcceew-consult')).toEqual(['Online submission'])
    const month = await readOpportunity('nature-repair-methods', repository)
    expect(month.opportunity.submissionDeadline).toBe('2026-11')
    expect(month.opportunity.startDate).toBe('2026-09-21T00:00:00.000Z')
    expect(histories.find(history => history.sourceUrl === month.opportunity.sourceUrl)?.uploadDate).toBe('2026-09-21')
    const exact = await readOpportunity('cultural-landscape-guidelines', repository)
    expect(exact.opportunity.submissionDeadline).toBe('2026-11-06T23:59:59.000Z')
    const ids = (await listOpportunities(repository)).map(row => row.id)
    expect(ids.indexOf('nature-repair-methods')).toBeLessThan(ids.indexOf('cultural-landscape-guidelines'))
    const biodiversity = await repository.findById('victorian-biodiversity-strategy-2037')
    expect(biodiversity?.fullText[0]).toBe('Department of Energy, Environment and Climate Action is seeking input on targets, priorities and a practical approach to measuring nature recovery.')
  })

  it('reruns without duplicates, restores seed content, and retains the existing opportunity ID', async () => {
    await seedDatabase(connection.client)
    const before = await connection.db.select().from(articleHistory).orderBy(articleHistory.sourceUrl)
    await connection.db.update(opportunities).set({ id: 'existing-stable-id', title: 'Edited title' })
      .where(eq(opportunities.id, 'nature-repair-methods'))
    expect(await seedDatabase(connection.client)).toEqual({ seeded: 12, skipped: 0, history: 12 })
    expect(await connection.db.select().from(opportunities)).toHaveLength(12)
    const repository = createOpportunityRepository(connection.db)
    expect(await repository.findById('nature-repair-methods')).toBeNull()
    expect((await repository.findById('existing-stable-id'))?.title).toBe('New methods for the Nature Repair Market')
    expect(await connection.db.select().from(articleHistory).orderBy(articleHistory.sourceUrl)).toEqual(before)
  })

  it('fills missing legacy seed dates while preserving known upload dates and content hashes', async () => {
    await seedDatabase(connection.client)
    const before = await connection.db.select().from(articleHistory).orderBy(articleHistory.sourceUrl)
    const changedUrl = before[0]!.sourceUrl
    const missingUrl = before[1]!.sourceUrl
    await connection.db.update(articleHistory).set({ uploadDate: '2020-02-29' }).where(eq(articleHistory.sourceUrl, changedUrl))
    await connection.db.update(articleHistory).set({ uploadDate: null }).where(eq(articleHistory.sourceUrl, missingUrl))
    await seedDatabase(connection.client)
    const after = await connection.db.select().from(articleHistory).orderBy(articleHistory.sourceUrl)
    expect(after[0]?.uploadDate).toBe('2020-02-29')
    expect(after[1]?.uploadDate).toBe(before[1]?.uploadDate)
    expect(after.map(history => history.hash)).toEqual(before.map(history => history.hash))
  })

  it('skips deleted URLs without clearing their marker or last successful hash', async () => {
    await seedDatabase(connection.client)
    const [row] = await connection.db.delete(opportunities).where(eq(opportunities.id, 'nature-repair-methods')).returning()
    const [before] = await connection.db.select().from(articleHistory).where(eq(articleHistory.sourceUrl, row!.sourceUrl))
    expect(before?.deleted).toBe(true)
    expect(await seedDatabase(connection.client)).toEqual({ seeded: 11, skipped: 1, history: 11 })
    const [after] = await connection.db.select().from(articleHistory).where(eq(articleHistory.sourceUrl, row!.sourceUrl))
    expect(after).toEqual(before)
    expect(await connection.db.select().from(opportunities)).toHaveLength(11)
  })

  it('preserves unrelated records and reads new platform features, changed data, and ordering from PostgreSQL', async () => {
    await connection.db.insert(websites).values({ id: 'additional-platform', tags: ['A database-only feature'] })
    await connection.db.insert(opportunities).values({
      id: 'additional-record', title: 'Additional record', fullText: ['Database content.'],
      sourceUrl: 'https://example.gov.au/additional', websiteId: 'additional-platform',
      sourceOrg: 'Additional authority', jurisdiction: 'Victoria',
      submissionDeadline: new Date('2025-01-01T00:00:00Z'), category: ['Climate change']
    })
    await seedDatabase(connection.client)
    const repository = createOpportunityRepository(connection.db)
    const list = await listOpportunities(repository)
    expect(list).toHaveLength(13)
    expect(list[0]?.id).toBe('additional-record')
    expect((await readOpportunity('additional-record', repository)).websiteTags).toEqual(['A database-only feature'])
    await connection.db.update(opportunities).set({ title: 'Changed in PostgreSQL' }).where(eq(opportunities.id, 'additional-record'))
    expect((await readOpportunity('additional-record', repository)).opportunity.title).toBe('Changed in PostgreSQL')
    await connection.db.delete(opportunities).where(eq(opportunities.id, 'additional-record'))
    await expect(readOpportunity('additional-record', repository)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('rolls back website updates, history placeholders, and opportunity writes on an ID conflict', async () => {
    await connection.db.insert(websites).values({ id: 'engage-victoria', tags: ['Keep this feature'] })
    await connection.db.insert(opportunities).values({
      id: 'nature-repair-methods', title: 'Unrelated consultation', fullText: ['Keep this content.'],
      sourceUrl: 'https://example.gov.au/unrelated', websiteId: 'engage-victoria',
      sourceOrg: 'Existing authority', jurisdiction: 'Victoria',
      submissionDeadline: new Date('2027-01-01T00:00:00Z'), category: ['Climate change']
    })
    await expect(seedDatabase(connection.client)).rejects.toMatchObject({ code: '23505' })
    expect(await connection.db.select().from(websites)).toEqual([{ id: 'engage-victoria', tags: ['Keep this feature'] }])
    expect(await connection.db.select().from(opportunities)).toHaveLength(1)
    expect(await connection.db.select().from(articleHistory)).toHaveLength(1)
    expect((await connection.db.select().from(opportunities))[0]?.title).toBe('Unrelated consultation')
  })

  it('returns empty results before seeding and sorts equal deadlines by ID', async () => {
    const repository = createOpportunityRepository(connection.db)
    expect(await listOpportunities(repository)).toEqual([])
    await expect(readOpportunity('missing', repository)).rejects.toMatchObject({ statusCode: 404 })
    await connection.db.insert(websites).values({ id: 'ties', tags: [] })
    for (const id of ['z', 'a']) await connection.db.insert(opportunities).values({
      id, title: id, fullText: ['Text.'], sourceUrl: `https://example.gov.au/${id}`,
      websiteId: 'ties', sourceOrg: 'Authority', jurisdiction: 'Victoria',
      submissionDeadline: new Date('2026-11-01T00:00:00Z'), category: ['Climate change']
    })
    expect((await listOpportunities(repository)).map(row => row.id)).toEqual(['a', 'z'])
  })
})
