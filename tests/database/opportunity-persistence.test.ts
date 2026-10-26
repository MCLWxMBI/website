import { randomUUID } from 'node:crypto'
import { mkdtemp, mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import postgres from 'postgres'
import { eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { connectDatabase } from '../../server/database'
import {
  articleHistory, opportunities, staticPages, users, websiteIndexes, websites,
  type NewOpportunity
} from '../../server/database/schema'
import { createOpportunityRepository } from '../../server/utils/opportunity-repository'
import { serializeOpportunity } from '../../server/services/opportunities'
import { toOpportunity } from '../../shared/utils/opportunity'
import { toStoredOpportunityDeadline } from '../../shared/utils/opportunity-deadline'

const databaseUrl = process.env.TEST_DATABASE_URL
if (!databaseUrl) throw new Error('Run npm run test:database and select an environment file.')

// Only the new, randomly named databases receive migrations or test writes.
// The selected database supplies the server connection and is never reset.
describe.each(['fresh', 'upgrade', 'upgrade-from-scraper', 'upgrade-from-deadline-precision'] as const)('%s PostgreSQL migration', scenario => {
  const databaseName = `echo_schema_test_${randomUUID().replaceAll('-', '')}`
  let admin: ReturnType<typeof postgres>
  let connection: ReturnType<typeof connectDatabase>
  let created = false
  let previousMigrations: string | undefined
  let sequence = 0

  function values(overrides: Partial<NewOpportunity> = {}): NewOpportunity {
    const id = `consultation-${++sequence}`
    return {
      id, title: 'Consultation title', fullText: ['First paragraph.', 'Second paragraph.'],
      sourceUrl: `https://example.gov.au/${id}`, websiteId: 'test-platform',
      sourceOrg: 'Publishing authority', jurisdiction: 'Victoria',
      submissionDeadline: new Date('2026-11-20T00:00:00Z'),
      category: ['Climate change'], ...overrides
    }
  }

  async function insert(overrides: Partial<NewOpportunity> = {}) {
    const [row] = await connection.db.insert(opportunities).values(values(overrides)).returning()
    return row!
  }

  async function rejectsConstraint(query: PromiseLike<unknown>, code = '23514') {
    await expect(query).rejects.toMatchObject({ cause: { code } })
  }

  beforeAll(async () => {
    admin = postgres(databaseUrl, { max: 1, connect_timeout: 5, onnotice: () => {} })
    // Start from the pristine template, without relying on local template1 edits.
    await admin.unsafe(`CREATE DATABASE "${databaseName}" TEMPLATE template0`)
    created = true
    const url = new URL(databaseUrl)
    url.pathname = `/${databaseName}`
    connection = connectDatabase(url.toString())

    if (scenario !== 'fresh') {
      previousMigrations = await mkdtemp(join(tmpdir(), 'echo-migrations-'))
      await mkdir(join(previousMigrations, 'meta'))
      const journal = JSON.parse(await readFile('drizzle/meta/_journal.json', 'utf8'))
      journal.entries = journal.entries.filter((entry: { idx: number }) => entry.idx <= (scenario === 'upgrade' ? 2 : scenario === 'upgrade-from-scraper' ? 3 : 4))
      await writeFile(join(previousMigrations, 'meta/_journal.json'), JSON.stringify(journal))
      for (const entry of journal.entries) {
        await copyFile(`drizzle/${entry.tag}.sql`, join(previousMigrations, `${entry.tag}.sql`))
      }
      await migrate(connection.db, { migrationsFolder: previousMigrations })
      const [user] = await connection.db.insert(users).values({ username: 'existing-admin', passwordHash: 'test-hash', role: 'admin' }).returning()
      await connection.db.insert(staticPages).values({ slug: 'about', contentHtml: '<h1>Existing page</h1>', updatedBy: user!.id })
      await connection.db.insert(websiteIndexes).values({ name: 'Existing index', indexUrl: 'https://example.gov.au/' })
      if (scenario === 'upgrade-from-scraper' || scenario === 'upgrade-from-deadline-precision') {
        await connection.client`INSERT INTO websites (id, tags) VALUES ('legacy-platform', '{}')`
        // Raw SQL works with the pre-upgrade schema (0003 or 0004).
        await connection.client`INSERT INTO opportunities
          (id, title, full_text, source_url, website_id, source_org, jurisdiction, submission_deadline, category)
          VALUES ('existing-opportunity', 'Existing consultation', ARRAY['Existing paragraph.'],
            'https://example.gov.au/existing-consultation', 'legacy-platform', 'Existing authority',
            'Victoria', '2026-11-20T17:23:45.123Z', ARRAY['Climate change'])`
        await connection.client`UPDATE article_history SET hash = repeat('a', 64) WHERE source_url = 'https://example.gov.au/existing-consultation'`
        await connection.client`INSERT INTO article_history (source_url, title, hash, deleted) VALUES ('https://example.gov.au/legacy-deleted', 'Deleted article', repeat('b', 64), TRUE)`
      }
    }

    await migrate(connection.db, { migrationsFolder: './drizzle' })
    await connection.db.insert(websites).values({ id: 'test-platform', tags: ['Login required', 'Online submission'] })
  })

  afterAll(async () => {
    try {
      if (connection) await connection.client.end({ timeout: 5 })
      if (created) await admin.unsafe(`DROP DATABASE "${databaseName}"`)
    } finally {
      if (admin) await admin.end({ timeout: 5 })
      if (previousMigrations) await rm(previousMigrations, { recursive: true, force: true })
    }
  })

  it('records the migration once and preserves the existing schema and data', async () => {
    const tables = await connection.client`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
    expect(tables.map(row => row.table_name)).toEqual([
      'article_history', 'opportunities', 'static_pages', 'users', 'website_indexes', 'websites'
    ])
    expect(await connection.client`SELECT * FROM drizzle.__drizzle_migrations`).toHaveLength(6)
    await migrate(connection.db, { migrationsFolder: './drizzle' })
    expect(await connection.client`SELECT * FROM drizzle.__drizzle_migrations`).toHaveLength(6)
    if (scenario !== 'fresh') {
      expect((await connection.db.select().from(users))[0]?.username).toBe('existing-admin')
      expect((await connection.db.select().from(staticPages))[0]?.contentHtml).toBe('<h1>Existing page</h1>')
      expect((await connection.db.select().from(websiteIndexes))[0]?.name).toBe('Existing index')
      if (scenario === 'upgrade-from-scraper' || scenario === 'upgrade-from-deadline-precision') {
        const [existing] = await connection.db.select().from(opportunities).where(eq(opportunities.id, 'existing-opportunity'))
        expect(existing?.submissionDeadline.toISOString()).toBe('2026-11-20T17:23:45.123Z')
        expect(existing?.submissionDeadlinePrecision).toBe('datetime')
        expect(serializeOpportunity(existing!).submissionDeadline).toBe('2026-11-20T17:23:45.123Z')
        const legacy = await connection.db.select().from(articleHistory).where(eq(articleHistory.sourceUrl, 'https://example.gov.au/existing-consultation'))
        expect(legacy[0]).toMatchObject({ uploadDate: null, hash: 'a'.repeat(64), deleted: false })
        const deleted = await connection.db.select().from(articleHistory).where(eq(articleHistory.sourceUrl, 'https://example.gov.au/legacy-deleted'))
        expect(deleted[0]).toMatchObject({ uploadDate: null, hash: 'b'.repeat(64), deleted: true })
      }
    }
  })

  it('reads website features and constructs the frontend model from a persisted row', async () => {
    const row = await insert()
    const repository = createOpportunityRepository(connection.db)
    expect(await repository.findWebsiteTags(row.websiteId)).toEqual(['Login required', 'Online submission'])
    expect(await repository.findWebsiteTags('missing')).toBeNull()
    expect(await repository.findById('missing')).toBeNull()
    const stored = await repository.findById(row.id)
    const response = serializeOpportunity(stored!)
    expect(response.website).toBe('test-platform')
    expect(response.startDate).toBeNull()
    expect(response.tags).toBeNull()
    expect(stored?.submissionDeadlinePrecision).toBe('datetime')
    expect(response.submissionDeadline).toBe('2026-11-20T00:00:00.000Z')
    expect(toOpportunity(response).summary).toBe('First paragraph.')
  })

  it('round-trips month-only deadlines and changes precision in both directions', async () => {
    const row = await insert({ ...toStoredOpportunityDeadline('2026-11'), startDate: new Date('2026-09-21T00:00:00Z') })
    expect(row.submissionDeadline.toISOString()).toBe('2026-11-01T00:00:00.000Z')
    expect(row.submissionDeadlinePrecision).toBe('month')
    expect(toOpportunity(serializeOpportunity(row)).submissionDeadline).toBe('2026-11')
    const [exact] = await connection.db.update(opportunities).set(toStoredOpportunityDeadline('2026-11-06T17:00:00Z'))
      .where(eq(opportunities.id, row.id)).returning()
    expect(serializeOpportunity(exact!).submissionDeadline).toBe('2026-11-06T17:00:00.000Z')
    const [month] = await connection.db.update(opportunities).set(toStoredOpportunityDeadline('2026-12'))
      .where(eq(opportunities.id, row.id)).returning()
    expect(serializeOpportunity(month!).submissionDeadline).toBe('2026-12')
  })

  it.each([
    ['unknown precision', { submissionDeadlinePrecision: 'day' }],
    ['non-first day', { submissionDeadlinePrecision: 'month', submissionDeadline: new Date('2026-11-02T00:00:00Z') }],
    ['non-midnight time', { submissionDeadlinePrecision: 'month', submissionDeadline: new Date('2026-11-01T00:00:00.001Z') }],
    ['local midnight instead of UTC', { submissionDeadlinePrecision: 'month', submissionDeadline: new Date('2026-11-01T00:00:00+11:00') }],
    ['opening after month start', { ...toStoredOpportunityDeadline('2026-11'), startDate: new Date('2026-11-01T00:00:00.001Z') }]
  ])('rejects invalid deadline storage: %s', async (_name, overrides) => {
    await rejectsConstraint(connection.db.insert(opportunities).values(values(overrides as Partial<NewOpportunity>)))
  })

  it.each(['0001-01-01 00:00:00+00 BC', '10000-01-01 00:00:00+00'])('rejects out-of-range month years (%s)', async timestamp => {
    const row = await insert(toStoredOpportunityDeadline('2026-11'))
    // PostgreSQL literals avoid JS ISO extended-year syntax being rejected by the driver first.
    await expect(connection.client`UPDATE opportunities SET submission_deadline = ${timestamp}::timestamptz WHERE id = ${row.id}`)
      .rejects.toMatchObject({ code: '23514' })
  })

  it('checks month normalization in UTC even when the database session uses Sydney time', async () => {
    const row = await insert(toStoredOpportunityDeadline('2026-11'))
    await connection.client.begin(async transaction => {
      await transaction`SET LOCAL TIME ZONE 'Australia/Sydney'`
      const [updated] = await transaction`UPDATE opportunities SET submission_deadline = '2026-12-01 00:00:00+00' WHERE id = ${row.id} RETURNING submission_deadline = '2026-12-01T00:00:00Z'::timestamptz AS normalized`
      expect(updated?.normalized).toBe(true)
    })
  })

  it('permits an opening exactly at the month deadline and enforces normalization on updates', async () => {
    const row = await insert({ ...toStoredOpportunityDeadline('2026-11'), startDate: new Date('2026-11-01T00:00:00Z') })
    await rejectsConstraint(connection.db.update(opportunities).set({ submissionDeadline: new Date('2026-11-02T00:00:00Z') })
      .where(eq(opportunities.id, row.id)))
  })

  it('enforces canonical URL uniqueness and keeps the original ID during an upsert', async () => {
    const row = await insert()
    await rejectsConstraint(connection.db.insert(opportunities).values(values({ sourceUrl: row.sourceUrl })), '23505')
    const [updated] = await connection.db.insert(opportunities).values(values({ sourceUrl: row.sourceUrl }))
      .onConflictDoUpdate({ target: opportunities.sourceUrl, set: { title: 'Updated title' } }).returning()
    expect(updated?.id).toBe(row.id)
    expect(updated?.title).toBe('Updated title')
  })

  it('requires an existing website and prevents deletion of a referenced website', async () => {
    await rejectsConstraint(connection.db.insert(opportunities).values(values({ websiteId: 'missing' })), '23503')
    await insert()
    await rejectsConstraint(connection.db.delete(websites).where(eq(websites.id, 'test-platform')), '23001')
    await rejectsConstraint(connection.db.insert(websites).values({ id: 'bad-features', tags: [' '] }))
    await connection.db.insert(websites).values({ id: 'no-features', tags: [] })
  })

  it.each([
    ['empty paragraphs', { fullText: [] }],
    ['blank paragraph', { fullText: [' '] }],
    ['null paragraph', { fullText: [null] }],
    ['padded paragraph', { fullText: [' padded'] }],
    ['multidimensional paragraphs', { fullText: [['Paragraph']] }],
    ['empty categories', { category: [] }],
    ['unknown category', { category: ['Unknown category'] }],
    ['duplicate categories', { category: ['Climate change', 'Climate change'] }],
    ['empty tags', { tags: [] }],
    ['null tag', { tags: [null] }],
    ['padded tag', { tags: ['Tag '] }],
    ['duplicate tags ignoring case', { tags: ['Invite-only', 'invite-only'] }],
    ['unknown jurisdiction', { jurisdiction: 'Unknown' }],
    ['HTTP source', { sourceUrl: 'http://example.gov.au/consultation' }],
    ['blank title', { title: ' ' }],
    ['blank summary', { summary: ' ' }],
    ['opening after deadline', { startDate: new Date('2027-01-01T00:00:00Z') }],
    ['missing geometry', { location: { label: 'Melbourne' } }],
    ['null geometry', { location: { label: 'Melbourne', geometry: null } }],
    ['unsupported geometry', { location: { label: 'Melbourne', geometry: { type: 'LineString', coordinates: [] } } }]
  ])('rejects %s', async (_name, overrides) => {
    await rejectsConstraint(connection.db.insert(opportunities).values(values(overrides as Partial<NewOpportunity>)))
  })

  it('rejects infinite timestamps while permitting equality at the deadline', async () => {
    const row = await insert({ startDate: new Date('2026-11-20T00:00:00Z') })
    await expect(connection.client`UPDATE opportunities SET submission_deadline = 'infinity' WHERE id = ${row.id}`)
      .rejects.toMatchObject({ code: '23514' })
    await expect(connection.client`UPDATE opportunities SET start_date = '-infinity' WHERE id = ${row.id}`)
      .rejects.toMatchObject({ code: '23514' })
  })

  it('permits repeated paragraphs, null tags and valid optional geography', async () => {
    const row = await insert({
      fullText: ['Repeated paragraph.', 'Repeated paragraph.'], tags: null,
      location: { label: 'Melbourne', geometry: { type: 'Point', coordinates: [144.9, -37.8] } }
    })
    expect(row.fullText).toHaveLength(2)
    expect(row.location?.geometry.type).toBe('Point')
  })

  it('retains the successful hash after deletion and blocks recreation until history is explicitly cleared', async () => {
    const row = await insert()
    const hash = 'a'.repeat(64)
    const [before] = await connection.db.select().from(articleHistory).where(eq(articleHistory.sourceUrl, row.sourceUrl))
    await connection.db.update(articleHistory).set({ hash }).where(eq(articleHistory.sourceUrl, row.sourceUrl))
    await connection.db.delete(opportunities).where(eq(opportunities.id, row.id))
    const [history] = await connection.db.select().from(articleHistory).where(eq(articleHistory.sourceUrl, row.sourceUrl))
    expect(history).toEqual({ sourceUrl: row.sourceUrl, title: row.title, hash, deleted: true, uploadDate: before!.uploadDate })
    expect(await connection.db.select().from(opportunities).where(eq(opportunities.id, row.id))).toEqual([])
    await rejectsConstraint(connection.db.insert(opportunities).values(values({ sourceUrl: row.sourceUrl })))
    await connection.db.delete(articleHistory).where(eq(articleHistory.sourceUrl, row.sourceUrl))
    await insert({ sourceUrl: row.sourceUrl })
  })

  it('creates deletion markers for untracked direct inserts and guards updates as well as inserts', async () => {
    const row = await insert()
    const [history] = await connection.db.select().from(articleHistory).where(eq(articleHistory.sourceUrl, row.sourceUrl))
    expect(history?.hash).toBeNull()
    expect(history?.deleted).toBe(false)
    await connection.db.update(articleHistory).set({ deleted: true }).where(eq(articleHistory.sourceUrl, row.sourceUrl))
    await rejectsConstraint(connection.db.update(opportunities).set({ title: 'Changed' }).where(eq(opportunities.id, row.id)))
    await connection.db.delete(opportunities).where(eq(opportunities.id, row.id))
    const [deleted] = await connection.db.select().from(articleHistory).where(eq(articleHistory.sourceUrl, row.sourceUrl))
    expect(deleted?.hash).toBeNull()
    expect(deleted?.deleted).toBe(true)
  })

  it('rolls back a deletion and its history marker atomically', async () => {
    const row = await insert()
    const rollback = new Error('Deliberate rollback')
    await expect(connection.db.transaction(async tx => {
      await tx.delete(opportunities).where(eq(opportunities.id, row.id))
      const [history] = await tx.select().from(articleHistory).where(eq(articleHistory.sourceUrl, row.sourceUrl))
      expect(history?.deleted).toBe(true)
      throw rollback
    })).rejects.toBe(rollback)
    expect(await connection.db.select().from(opportunities).where(eq(opportunities.id, row.id))).toHaveLength(1)
    const [history] = await connection.db.select().from(articleHistory).where(eq(articleHistory.sourceUrl, row.sourceUrl))
    expect(history?.deleted).toBe(false)
  })

  it('defaults new upload dates to the UTC day even in a different session timezone', async () => {
    await connection.client.begin(async transaction => {
      await transaction`SET LOCAL TIME ZONE 'Pacific/Kiritimati'`
      const [row] = await transaction`INSERT INTO article_history (source_url, title)
        VALUES (${'https://example.gov.au/utc-date-' + randomUUID()}, 'Default UTC date')
        RETURNING upload_date = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date AS matches_utc`
      expect(row?.matches_utc).toBe(true)
    })
  })

  it('stores an explicit date without a time and preserves it when the scrape hash changes', async () => {
    const url = 'https://example.gov.au/explicit-date-' + randomUUID()
    const [row] = await connection.db.insert(articleHistory).values({
      sourceUrl: url, title: 'Dated article', uploadDate: '2024-02-29'
    }).returning()
    expect(row?.uploadDate).toBe('2024-02-29')
    const [updated] = await connection.db.update(articleHistory).set({ hash: 'c'.repeat(64) })
      .where(eq(articleHistory.sourceUrl, url)).returning()
    expect(updated?.uploadDate).toBe('2024-02-29')
  })

  it.each(['infinity', '-infinity'])('rejects a non-finite upload date (%s)', async date => {
    await expect(connection.client`INSERT INTO article_history (source_url, title, upload_date)
      VALUES (${'https://example.gov.au/infinite-date-' + randomUUID()}, 'Invalid date', ${date}::date)`)
      .rejects.toMatchObject({ code: '23514' })
  })

  it.each(['2026-02-30', '2026-13-01'])('rejects an invalid calendar upload date (%s)', async date => {
    await expect(connection.client`INSERT INTO article_history (source_url, title, upload_date)
      VALUES (${'https://example.gov.au/invalid-date-' + randomUUID()}, 'Invalid date', ${date}::date)`)
      .rejects.toMatchObject({ code: '22008' })
  })

  it('rejects malformed successful hashes', async () => {
    await rejectsConstraint(connection.db.insert(articleHistory).values({ sourceUrl: 'https://example.gov.au/bad-hash', title: 'Title', hash: 'title-hash' }))
  })
})
