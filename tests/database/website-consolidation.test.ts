import { randomUUID } from 'node:crypto'
import { mkdtemp, mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import postgres from 'postgres'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { connectDatabase } from '../../server/database'

const databaseUrl = process.env.TEST_DATABASE_URL
if (!databaseUrl) throw new Error('Use npm run test:database.')

describe.each(['empty', 'website', 'opportunity'] as const)('website consolidation: %s legacy tables', scenario => {
  const name = `echo_consolidation_test_${randomUUID().replaceAll('-', '')}`
  let control: ReturnType<typeof postgres>
  let connection: ReturnType<typeof connectDatabase>
  let previous: string | undefined
  let created = false
  beforeAll(async () => {
    control = postgres(databaseUrl, { max: 1, onnotice: () => {} })
    await control.unsafe(`CREATE DATABASE "${name}" TEMPLATE template0`)
    created = true
    const url = new URL(databaseUrl); url.pathname = `/${name}`
    connection = connectDatabase(url.toString())
    previous = await mkdtemp(join(tmpdir(), 'echo-before-consolidation-'))
    await mkdir(join(previous, 'meta'))
    const journal = JSON.parse(await readFile('drizzle/meta/_journal.json', 'utf8'))
    journal.entries = journal.entries.filter((entry: { idx: number }) => entry.idx <= 6)
    await writeFile(join(previous, 'meta/_journal.json'), JSON.stringify(journal))
    for (const entry of journal.entries) await copyFile(`drizzle/${entry.tag}.sql`, join(previous, `${entry.tag}.sql`))
    await migrate(connection.db, { migrationsFolder: previous })
    await connection.client`INSERT INTO website_indexes (name,index_url,active,notes) VALUES ('Keep source','https://example.gov.au',false,'Keep notes')`
    await connection.client`INSERT INTO article_history (source_url,title,hash,deleted,upload_date,source_index_id)
      VALUES ('https://example.gov.au/deleted','Keep history',repeat('a',64),true,'2020-02-29',1)`
    if (scenario !== 'empty') await connection.client`INSERT INTO websites (id,tags) VALUES ('legacy',ARRAY['Login required'])`
    if (scenario === 'opportunity') await connection.client`INSERT INTO opportunities
      (id,title,full_text,source_url,website_id,source_org,jurisdiction,submission_deadline,category)
      VALUES ('legacy','Legacy',ARRAY['Text.'],'https://example.gov.au/legacy','legacy','Authority','Victoria','2027-01-01Z',ARRAY['Climate change'])`
  })
  afterAll(async () => {
    if (connection) await connection.client.end({ timeout: 5 })
    if (created) await control.unsafe(`DROP DATABASE "${name}"`)
    if (control) await control.end({ timeout: 5 })
    if (previous) await rm(previous, { recursive: true, force: true })
  })
  it('preserves existing records and commits only when both legacy tables are empty', async () => {
    const histories = await connection.client`SELECT * FROM article_history ORDER BY source_url`
    if (scenario === 'empty') {
      await migrate(connection.db, { migrationsFolder: './drizzle' })
      expect(await connection.client`SELECT * FROM website_indexes`).toEqual([{ id: '1', name: 'Keep source', index_url: 'https://example.gov.au', active: false, notes: 'Keep notes', tags: [] }])
      const [schema] = await connection.client`SELECT to_regclass('public.websites') IS NULL AS old_table_removed,
        (SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='opportunities' AND column_name='website_id') AS id_type`
      expect(schema).toEqual({ old_table_removed: true, id_type: 'bigint' })
      expect(await connection.client`SELECT * FROM drizzle.__drizzle_migrations`).toHaveLength(10)
      await expect(connection.client`INSERT INTO opportunities
        (id,title,full_text,source_url,website_id,source_org,jurisdiction,submission_deadline,category)
        VALUES ('deleted','Deleted',ARRAY['Text.'],'https://example.gov.au/deleted',1,'Authority','Victoria','2027-01-01Z',ARRAY['Climate change'])`)
        .rejects.toMatchObject({ code: '23514' })
    } else {
      await expect(migrate(connection.db, { migrationsFolder: './drizzle' })).rejects.toThrow()
      expect(await connection.client`SELECT * FROM drizzle.__drizzle_migrations`).toHaveLength(7)
      const [schema] = await connection.client`SELECT to_regclass('public.websites') IS NOT NULL AS old_table_retained,
        (SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='opportunities' AND column_name='website_id') AS id_type,
        EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='website_indexes' AND column_name='tags') AS tags_added`
      expect(schema).toEqual({ old_table_retained: true, id_type: 'text', tags_added: false })
      expect(await connection.client`SELECT * FROM websites`).toEqual([{ id: 'legacy', tags: ['Login required'] }])
      expect(await connection.client`SELECT id FROM opportunities`).toHaveLength(scenario === 'opportunity' ? 1 : 0)
    }
    expect(await connection.client`SELECT * FROM article_history ORDER BY source_url`).toEqual(histories)
    const [trigger] = await connection.client`SELECT tgenabled FROM pg_trigger WHERE tgname='opportunities_guard_deleted'`
    expect(trigger?.tgenabled).toBe('O')
  })
})
