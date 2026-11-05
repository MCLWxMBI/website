import { randomUUID } from 'node:crypto'
import { mkdtemp, mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import postgres from 'postgres'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { connectDatabase } from '../../server/database'
import { createOpportunityRepository } from '../../server/utils/opportunity-repository'
import { createAdminOpportunityRepository } from '../../server/utils/admin-opportunity-repository'
import { listOpportunities, readOpportunity } from '../../server/services/opportunities'
import { publishAdminOpportunity } from '../../server/services/admin-opportunities'
import { getOpportunityAccess } from '../../app/utils/opportunity-access'
import { makeCreateOpportunity } from '../support/admin-opportunity'

const databaseUrl = process.env.TEST_DATABASE_URL
if (!databaseUrl) throw new Error('Use npm run test:database.')

describe('opportunities inherit website source tags', () => {
  const name = `echo_source_tags_test_${randomUUID().replaceAll('-', '')}`
  let control: ReturnType<typeof postgres>
  let connection: ReturnType<typeof connectDatabase>
  let previous: string | undefined
  let created = false
  let beforeOpportunity: Record<string, unknown>
  let beforeHistory: unknown[]
  beforeAll(async () => {
    control = postgres(databaseUrl, { max: 1, onnotice: () => {} })
    await control.unsafe(`CREATE DATABASE "${name}" TEMPLATE template0`)
    created = true
    const url = new URL(databaseUrl); url.pathname = `/${name}`
    connection = connectDatabase(url.toString())
    previous = await mkdtemp(join(tmpdir(), 'echo-before-source-tags-'))
    await mkdir(join(previous, 'meta'))
    const journal = JSON.parse(await readFile('drizzle/meta/_journal.json', 'utf8'))
    journal.entries = journal.entries.filter((entry: { idx: number }) => entry.idx <= 8)
    await writeFile(join(previous, 'meta/_journal.json'), JSON.stringify(journal))
    for (const entry of journal.entries) await copyFile(`drizzle/${entry.tag}.sql`, join(previous, `${entry.tag}.sql`))
    await migrate(connection.db, { migrationsFolder: previous })
    await connection.client`INSERT INTO website_indexes (name,index_url,active,notes,tags)
      VALUES ('Shared source','https://tags.gov.au',false,'Keep notes',ARRAY['Invite-only','Login required'])`
    const [row] = await connection.client`INSERT INTO opportunities
      (id,title,full_text,source_url,website_id,source_org,jurisdiction,submission_deadline,category,tags)
      VALUES ('existing','Existing',ARRAY['Text.'],'https://tags.gov.au/existing',1,'Authority','Victoria','2040-01-01Z',ARRAY['Climate change'],ARRAY['Old opportunity label']) RETURNING *`
    beforeOpportunity = row!
    await connection.client`UPDATE article_history SET hash=repeat('a',64), upload_date='2020-02-29', source_index_id=1`
    beforeHistory = await connection.client`SELECT * FROM article_history ORDER BY source_url`
    await migrate(connection.db, { migrationsFolder: './drizzle' })
  })
  afterAll(async () => {
    if (connection) await connection.client.end({ timeout: 5 })
    if (created) await control.unsafe(`DROP DATABASE "${name}"`)
    if (control) await control.end({ timeout: 5 })
    if (previous) await rm(previous, { recursive: true, force: true })
  })
  it('drops only opportunity tags and retains source tags, other opportunity fields, and history', async () => {
    const { tags: _removed, ...retained } = beforeOpportunity
    expect((await connection.client`SELECT * FROM opportunities`)[0]).toEqual(retained)
    expect(await connection.client`SELECT * FROM article_history ORDER BY source_url`).toEqual(beforeHistory)
    const [source] = await connection.client`SELECT tags,active,notes FROM website_indexes WHERE id=1`
    expect(source).toEqual({ tags: ['Invite-only', 'Login required'], active: false, notes: 'Keep notes' })
    const constraints = await connection.client`SELECT 1 FROM pg_constraint WHERE conrelid='public.opportunities'::regclass AND conname='opportunities_tags_valid'`
    expect(constraints).toHaveLength(0)
    const repo = createOpportunityRepository(connection.db)
    const [opportunity] = await listOpportunities(repo)
    expect(opportunity?.tags).toEqual(source!.tags)
    expect(getOpportunityAccess(opportunity!)).toBe('invite-only')
    expect((await readOpportunity('existing', repo)).websiteTags).toEqual(source!.tags)
  })
  it('saves the creation controls to the source and updates access for every linked opportunity', async () => {
    const published = await publishAdminOpportunity(makeCreateOpportunity({ tags: [' Login required ', 'invite-only', 'Invite-only'] }), createAdminOpportunityRepository(connection.db))
    expect(published.websiteTags).toEqual(['Login required', 'Invite-only'])
    const repo = createOpportunityRepository(connection.db)
    expect((await listOpportunities(repo)).every(row => getOpportunityAccess(row) === 'invite-only')).toBe(true)
    await publishAdminOpportunity(makeCreateOpportunity({ sourceUrl: 'https://tags.gov.au/clear', tags: null }), createAdminOpportunityRepository(connection.db))
    const rows = await listOpportunities(repo)
    expect(rows).toHaveLength(3)
    expect(rows.every(row => row.tags === null && getOpportunityAccess(row) === 'public')).toBe(true)
    expect((await readOpportunity('existing', repo)).websiteTags).toEqual([])
  })
  it('rolls back source tag edits if publication fails later', async () => {
    const before = await connection.client`SELECT * FROM website_indexes WHERE id=1`
    const repo = createAdminOpportunityRepository(connection.db)
    await expect(repo.create(makeCreateOpportunity({ sourceUrl: 'https://tags.gov.au/rollback', tags: ['Must roll back'] }), 'existing')).rejects.toThrow()
    expect(await connection.client`SELECT * FROM website_indexes WHERE id=1`).toEqual(before)
  })
})
