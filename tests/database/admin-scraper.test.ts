import { randomUUID } from 'node:crypto'
import { mkdtemp, mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import postgres from 'postgres'
import { eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { connectDatabase } from '../../server/database'
import { articleHistory, opportunities, websiteIndexes, websites } from '../../server/database/schema'
import { createAdminScraperRepository } from '../../server/utils/admin-scraper-repository'
import { readAdminScraperArticles } from '../../server/services/admin-scraper'
import { seedDatabase } from '../../scripts/seed-database'

const databaseUrl = process.env.TEST_DATABASE_URL
if (!databaseUrl) throw new Error('Use npm run test:database.')

describe('source tracking and admin scraper panel', () => {
  const name = `echo_articles_test_${randomUUID().replaceAll('-', '')}`
  let admin: ReturnType<typeof postgres>
  let connection: ReturnType<typeof connectDatabase>
  let previous: string
  let created = false
  let repository: ReturnType<typeof createAdminScraperRepository>
  beforeAll(async () => {
    admin = postgres(databaseUrl, { max: 1, onnotice: () => {} })
    await admin.unsafe(`CREATE DATABASE "${name}" TEMPLATE template0`)
    created = true
    const url = new URL(databaseUrl); url.pathname = `/${name}`
    connection = connectDatabase(url.toString())
    repository = createAdminScraperRepository(connection.db)
    previous = await mkdtemp(join(tmpdir(), 'echo-article-migrations-'))
    await mkdir(join(previous, 'meta'))
    const journal = JSON.parse(await readFile('drizzle/meta/_journal.json', 'utf8'))
    journal.entries = journal.entries.filter((e: { idx: number }) => e.idx <= 5)
    await writeFile(join(previous, 'meta/_journal.json'), JSON.stringify(journal))
    for (const e of journal.entries) await copyFile(`drizzle/${e.tag}.sql`, join(previous, `${e.tag}.sql`))
    await migrate(connection.db, { migrationsFolder: previous })
  })
  afterAll(async () => {
    if (connection) await connection.client.end({ timeout: 5 })
    if (created) await admin.unsafe(`DROP DATABASE "${name}"`)
    if (admin) await admin.end({ timeout: 5 })
    if (previous) await rm(previous, { recursive: true, force: true })
  })
  // The first test upgrades legacy data; subsequent tests use the migrated schema.
  it('backfills unique, most-specific URL prefixes without guessing ambiguous or unrelated sources', async () => {
    await connection.client`INSERT INTO website_indexes (name, index_url) VALUES
      ('Broad', 'https://example.gov.au/project'),
      ('Specific', 'https://EXAMPLE.gov.au:443/project/nested/?page=1#top'),
      ('Duplicate A', 'https://example.gov.au/duplicate'),
      ('Duplicate B', 'https://example.gov.au/duplicate/')`
    const urls = ['project/article', 'project/nested/article?x=1#top', 'projects/article', 'duplicate/article', 'other']
    for (const path of urls) await connection.client`INSERT INTO article_history (source_url,title,hash,upload_date,deleted)
      VALUES (${`https://example.gov.au/${path}`}, 'Legacy', ${'a'.repeat(64)}, '2020-01-02', true)`
    await connection.client`INSERT INTO article_history (source_url,title) VALUES ('https://other.gov.au/project/article', 'Other origin')`
    await migrate(connection.db, { migrationsFolder: './drizzle' })
    const rows = await connection.db.select({ url: articleHistory.sourceUrl, source: websiteIndexes.name,
      hash: articleHistory.hash, date: articleHistory.uploadDate, deleted: articleHistory.deleted })
      .from(articleHistory).leftJoin(websiteIndexes, eq(articleHistory.sourceIndexId, websiteIndexes.id))
    expect(rows.find(r => r.url === 'https://example.gov.au/project/article')?.source).toBe('Broad')
    expect(rows.find(r => r.url.includes('/nested/'))?.source).toBe('Specific')
    for (const suffix of ['projects/article', 'duplicate/article', '/other']) expect(rows.find(r => r.url.endsWith(suffix))?.source).toBeNull()
    expect(rows.find(r => r.url.startsWith('https://other.gov'))?.source).toBeNull()
    for (const row of rows.filter(r => r.hash)) expect(row).toMatchObject({ hash: 'a'.repeat(64), date: '2020-01-02', deleted: true })
  })

  describe('migrated queries', () => {
    let sourceId: bigint
    beforeEach(async () => {
      await connection.client`TRUNCATE opportunities, article_history, websites, website_indexes RESTART IDENTITY`
      const [source] = await connection.db.insert(websiteIndexes).values({ name: 'Zulu', indexUrl: 'https://example.gov.au/project', active: false }).returning()
      sourceId = source!.id
      await connection.db.insert(websiteIndexes).values({ name: 'Alpha empty', indexUrl: 'https://empty.gov.au' })
    })
    async function history(path: string, overrides: Partial<typeof articleHistory.$inferInsert> = {}) {
      await connection.db.insert(articleHistory).values({ sourceUrl: `https://example.gov.au/${path}`, title: path,
        sourceIndexId: sourceId, uploadDate: '2026-01-01', ...overrides })
    }
    it('includes empty/inactive sources and counts all history statuses and unassigned rows', async () => {
      await history('success', { hash: 'b'.repeat(64) }); await history('deleted', { deleted: true })
      await history('tracked'); await history('unknown', { sourceIndexId: null })
      const result = await repository.sources()
      expect(result.sources.map(r => [r.name, r.articleCount, r.active])).toEqual([['Alpha empty', 0, true], ['Zulu', 3, false]])
      expect(result.unassignedCount).toBe(1)
      expect(result.sources[1]?.id).toBe(sourceId.toString())
    })
    it('sorts most recent first, breaks ties by URL, puts unknown dates last, and joins opportunities', async () => {
      await history('unknown', { uploadDate: null }); await history('z'); await history('a')
      await history('recent', { uploadDate: '2026-02-01', hash: 'c'.repeat(64) })
      await connection.db.insert(websites).values({ id: 'platform', tags: [] })
      await connection.db.insert(opportunities).values({ id: 'linked', title: 'Linked', fullText: ['Text.'],
        sourceUrl: 'https://example.gov.au/recent', websiteId: 'platform', sourceOrg: 'Org', jurisdiction: 'Victoria',
        submissionDeadline: new Date('2027-01-01Z'), category: ['Climate change'] })
      const result = await repository.articles({ sourceId, q: '', page: 1 })
      expect(result?.items.map(r => r.title)).toEqual(['recent', 'a', 'z', 'unknown'])
      expect(result?.items[0]).toMatchObject({ opportunityId: 'linked', hasSuccessfulScrape: true, uploadDate: '2026-02-01' })
      expect(result?.items[1]).toMatchObject({ opportunityId: null, hasSuccessfulScrape: false })
      await connection.db.delete(opportunities).where(eq(opportunities.id, 'linked'))
      expect((await connection.db.select().from(articleHistory).where(eq(articleHistory.sourceUrl, 'https://example.gov.au/recent')))[0])
        .toMatchObject({ sourceIndexId: sourceId, deleted: true, hash: 'c'.repeat(64), uploadDate: '2026-02-01' })
    })
    it('searches literal title substrings case-insensitively within the selected source', async () => {
      await history('one', { title: 'Water 100%_plan\\draft' })
      await history('two', { title: 'Water 100XXplanXdraft' })
      await history('other', { title: 'Water 100%_plan\\draft', sourceIndexId: null })
      for (const q of ['WATER', '100%_', 'plan\\draft']) {
        const result = await repository.articles({ sourceId, q, page: 1 })
        expect(result?.total).toBe(q === 'WATER' ? 2 : 1)
      }
    })
    it('filters and sorts before pagination, clamps pages, and distinguishes missing/empty sources', async () => {
      for (let i = 0; i < 30; i++) await history(`item-${String(i).padStart(2, '0')}`)
      const result = await repository.articles({ sourceId, q: 'item', page: 999 })
      expect(result).toMatchObject({ total: 30, page: 2, pageSize: 25 })
      expect(result?.items.map(r => r.title)).toEqual(['item-25', 'item-26', 'item-27', 'item-28', 'item-29'])
      expect(await repository.articles({ sourceId, q: 'missing', page: 10 })).toMatchObject({ items: [], page: 1, total: 0 })
      await expect(readAdminScraperArticles({ source: '999' }, repository)).rejects.toMatchObject({ statusCode: 404 })
      expect(await repository.articles({ sourceId: null, q: '', page: 1 })).toMatchObject({ items: [], total: 0 })
    })
    it('retains all history metadata and moves articles to unassigned when an index is deleted', async () => {
      await history('retained', { deleted: true, hash: 'd'.repeat(64) })
      await connection.db.delete(websiteIndexes).where(eq(websiteIndexes.id, sourceId))
      const [row] = await connection.db.select().from(articleHistory)
      expect(row).toMatchObject({ sourceIndexId: null, deleted: true, hash: 'd'.repeat(64), uploadDate: '2026-01-01' })
      expect((await repository.sources()).unassignedCount).toBe(1)
      await expect(connection.db.insert(articleHistory).values({ sourceUrl: 'https://example.gov.au/bad', title: 'Bad FK', sourceIndexId: 999n }))
        .rejects.toMatchObject({ cause: { code: '23503' } })
    })
    it('links seed articles when registry entries exist and preserves hashes, dates, and known associations on rerun', async () => {
      await seedDatabase(connection.client)
      const before = await connection.db.select().from(articleHistory).orderBy(articleHistory.sourceUrl)
      expect(before.every(r => r.sourceIndexId === null)).toBe(true)
      await connection.db.insert(websiteIndexes).values([
        { name: 'Engage Victoria', indexUrl: 'https://engage.vic.gov.au/project' },
        { name: 'DCCEEW', indexUrl: 'https://consult.dcceew.gov.au/find-consultations' }
      ])
      await seedDatabase(connection.client)
      const linked = await connection.db.select().from(articleHistory).orderBy(articleHistory.sourceUrl)
      expect(linked.every(r => r.sourceIndexId !== null)).toBe(true)
      expect(linked.map(r => r.hash)).toEqual(before.map(r => r.hash))
      expect(linked.map(r => r.uploadDate)).toEqual(before.map(r => r.uploadDate))
      await connection.db.update(articleHistory).set({ sourceIndexId: sourceId }).where(eq(articleHistory.sourceUrl, linked[0]!.sourceUrl))
      await seedDatabase(connection.client)
      expect((await connection.db.select().from(articleHistory).where(eq(articleHistory.sourceUrl, linked[0]!.sourceUrl)))[0]?.sourceIndexId).toBe(sourceId)
    })
  })
})
