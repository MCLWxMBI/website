import { randomUUID } from 'node:crypto'
import { mkdtemp, mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import postgres from 'postgres'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { connectDatabase } from '../../server/database'
import { articleHistory, categories, opportunities, websiteIndexes } from '../../server/database/schema'
import { opportunityCategories } from '../../shared/types/opportunity'
import { seedDatabase } from '../../scripts/seed-database'

const databaseUrl = process.env.TEST_DATABASE_URL
if (!databaseUrl) throw new Error('Use npm run test:database.')

describe('category catalogue migration and seeds', () => {
  const name = `echo_categories_test_${randomUUID().replaceAll('-', '')}`
  let control: ReturnType<typeof postgres>
  let connection: ReturnType<typeof connectDatabase>
  let previous: string | undefined
  let created = false
  let existing: { opportunities: unknown[]; history: unknown[]; sources: unknown[] }
  beforeAll(async () => {
    control = postgres(databaseUrl, { max: 1, onnotice: () => {} })
    await control.unsafe(`CREATE DATABASE "${name}" TEMPLATE template0`)
    created = true
    const url = new URL(databaseUrl); url.pathname = `/${name}`
    connection = connectDatabase(url.toString())
    previous = await mkdtemp(join(tmpdir(), 'echo-before-categories-'))
    await mkdir(join(previous, 'meta'))
    const journal = JSON.parse(await readFile('drizzle/meta/_journal.json', 'utf8'))
    journal.entries = journal.entries.filter((entry: { idx: number }) => entry.idx <= 7)
    await writeFile(join(previous, 'meta/_journal.json'), JSON.stringify(journal))
    for (const entry of journal.entries) await copyFile(`drizzle/${entry.tag}.sql`, join(previous, `${entry.tag}.sql`))
    await migrate(connection.db, { migrationsFolder: previous })
    await connection.db.insert(websiteIndexes).values({ id: 900n, name: 'Keep source', indexUrl: 'https://categories-test.gov.au', active: false, notes: 'Keep notes', tags: ['Keep feature'] })
    await connection.db.insert(opportunities).values({ id: 'category-migration-existing', title: 'Keep opportunity', fullText: ['Keep content.'],
      sourceUrl: 'https://categories-test.gov.au/existing', websiteId: 900n, sourceOrg: 'Authority', jurisdiction: 'Victoria',
      submissionDeadline: new Date('2040-01-01T00:00:00Z'), category: ['Climate change'] })
    await connection.client`UPDATE article_history SET hash=repeat('a',64), upload_date='2020-02-29', source_index_id=900`
    existing = { opportunities: await connection.db.select().from(opportunities), history: await connection.db.select().from(articleHistory), sources: await connection.db.select().from(websiteIndexes) }
    await migrate(connection.db, { migrationsFolder: './drizzle' })
  })
  beforeEach(async () => { await connection.client`TRUNCATE categories RESTART IDENTITY` })
  afterAll(async () => {
    if (connection) await connection.client.end({ timeout: 5 })
    if (created) await control.unsafe(`DROP DATABASE "${name}"`)
    if (control) await control.end({ timeout: 5 })
    if (previous) await rm(previous, { recursive: true, force: true })
  })
  it('adds an empty catalogue to a populated 0007 database without changing its records', async () => {
    expect(await connection.db.select().from(categories)).toEqual([])
    expect(await connection.db.select().from(opportunities)).toEqual(existing.opportunities)
    expect(await connection.db.select().from(articleHistory)).toEqual(existing.history)
    expect(await connection.db.select().from(websiteIndexes)).toEqual(existing.sources)
    expect(await connection.client`SELECT * FROM drizzle.__drizzle_migrations`).toHaveLength(10)
  })
  it.each(['root', 'development'])('%s seed inserts every current filter category and preserves IDs and extra rows on rerun', async seed => {
    await connection.db.insert(categories).values({ name: 'Additional category' })
    const run = async () => seed === 'root'
      ? connection.client.unsafe(await readFile('seed.sql', 'utf8')).simple()
      : seedDatabase(connection.client)
    await run()
    const before = await connection.db.select().from(categories).orderBy(categories.id)
    expect(before.map(category => category.name).sort()).toEqual([...opportunityCategories, 'Additional category'].sort())
    await run()
    expect(await connection.db.select().from(categories).orderBy(categories.id)).toEqual(before)
  })
  it('generates IDs and rejects duplicate names', async () => {
    const [row] = await connection.db.insert(categories).values({ name: 'Climate change' }).returning()
    expect(row).toEqual({ id: expect.any(Number), name: 'Climate change' })
    await expect(connection.db.insert(categories).values({ name: 'Climate change' })).rejects.toMatchObject({ cause: { code: '23505' } })
  })
  it.each(['', ' ', '\t', ' Climate change', 'Climate change ', '\nClimate change'])('rejects blank or untrimmed names %j', async name => {
    await expect(connection.db.insert(categories).values({ name })).rejects.toMatchObject({ cause: { code: '23514' } })
  })
})
