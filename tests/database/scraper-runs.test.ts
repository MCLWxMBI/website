import { randomUUID } from 'node:crypto'
import { mkdtemp, mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import postgres from 'postgres'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectDatabase } from '../../server/database'
import { seedDatabase } from '../../scripts/seed-database'
import { createScraperRunsRepository } from '../../server/utils/admin-scraper-runs-repository'
import { listScraperRuns, readScraperRun } from '../../server/services/admin-scraper-runs'

const databaseUrl = process.env.TEST_DATABASE_URL
if (!databaseUrl) throw new Error('Use npm run test:database.')
describe('scraper run persistence and development fixtures', () => {
  const name = `echo_runs_test_${randomUUID().replaceAll('-', '')}`
  let control: ReturnType<typeof postgres>, connection: ReturnType<typeof connectDatabase>
  let created = false, previous: string | undefined
  beforeAll(async () => {
    control = postgres(databaseUrl, { max: 1, onnotice: () => {} })
    await control.unsafe(`CREATE DATABASE "${name}" TEMPLATE template0`); created = true
    const url = new URL(databaseUrl); url.pathname = `/${name}`; connection = connectDatabase(url.toString())
    previous = await mkdtemp(join(tmpdir(), 'echo-before-runs-')); await mkdir(join(previous, 'meta'))
    const journal = JSON.parse(await readFile('drizzle/meta/_journal.json', 'utf8'))
    journal.entries = journal.entries.filter((entry: { idx: number }) => entry.idx <= 9)
    await writeFile(join(previous, 'meta/_journal.json'), JSON.stringify(journal))
    for (const entry of journal.entries) await copyFile(`drizzle/${entry.tag}.sql`, join(previous, `${entry.tag}.sql`))
    await migrate(connection.db, { migrationsFolder: previous })
    await connection.client`INSERT INTO website_indexes (name,index_url,tags) VALUES ('Preserved','https://preserved.gov.au',ARRAY['Original tag'])`
    await connection.client`INSERT INTO article_history(source_url,title,upload_date) VALUES ('https://preserved.gov.au/article','Preserved article','2020-01-01')`
    const sources = await connection.client`SELECT * FROM website_indexes`, history = await connection.client`SELECT * FROM article_history`
    await migrate(connection.db, { migrationsFolder: './drizzle' })
    expect(await connection.client`SELECT * FROM website_indexes`).toEqual(sources)
    expect(await connection.client`SELECT * FROM article_history`).toEqual(history)
  })
  afterAll(async () => {
    if (connection) await connection.client.end({ timeout: 5 })
    if (created) await control.unsafe(`DROP DATABASE "${name}"`)
    if (control) await control.end({ timeout: 5 })
    if (previous) await rm(previous, { recursive: true, force: true })
  })
  beforeEach(async () => { await connection.client`TRUNCATE scraper_runs, opportunities, article_history, website_indexes, categories RESTART IDENTITY` })

  it('creates exactly the six supplied columns with only a primary-key constraint', async () => {
    const columns = await connection.client`SELECT column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_name='scraper_runs' ORDER BY ordinal_position`
    expect(columns.map(row => row.column_name)).toEqual(['id', 'started_at', 'finished_at', 'status', 'sources', 'extracted_opportunities'])
    expect(columns[0]!.column_default).toContain('nextval')
    expect(columns[1]).toMatchObject({ data_type: 'timestamp with time zone', is_nullable: 'NO', column_default: 'now()' })
    expect(columns[2]!.is_nullable).toBe('YES')
    expect((await connection.client`SELECT contype FROM pg_constraint WHERE conrelid='public.scraper_runs'::regclass AND contype <> 'n'`).map(row => row.contype)).toEqual(['p'])
    const [run] = await connection.client`INSERT INTO scraper_runs DEFAULT VALUES RETURNING *`
    expect(run).toMatchObject({ status: 'running', finished_at: null, sources: [], extracted_opportunities: [] })
  })
  it('seeds six complete scenarios idempotently, preserving unrelated runs and reporting counts', async () => {
    expect(await seedDatabase(connection.client)).toMatchObject({ runsSeeded: 6, runsSkipped: 0 })
    const repo = createScraperRunsRepository(connection.db)
    const list = await listScraperRuns({}, repo)
    expect(list.total).toBe(6)
    expect(new Set(list.items.map(row => row.status))).toEqual(new Set(['running', 'passed', 'failed', 'interrupted']))
    const details = await Promise.all(list.items.map(row => readScraperRun(row.id, repo)))
    expect(new Set(details.flatMap(run => run.sources.map(source => source.status)))).toEqual(new Set(['passed', 'failed', 'empty', 'skipped']))
    expect(details.find(run => run.status === 'running')).toMatchObject({ finishedAt: null, sources: [], extractedOpportunities: [] })
    expect(details.some(run => run.status === 'failed' && run.totals.passedCount > 0)).toBe(true)
    expect(details.some(run => run.sources.some(source => source.status === 'failed' && source.failedCount === 0))).toBe(true)
    for (const run of details) for (const source of run.sources) {
      expect(source.processedCount).toBe(source.passedCount + source.invalidCount + source.failedCount)
      expect(run.extractedOpportunities.find(group => group.websiteIndexId === source.websiteIndexId)!.titles).toHaveLength(source.passedCount)
      const [index] = await connection.client`SELECT name,index_url FROM website_indexes WHERE id=${source.websiteIndexId}`
      expect(index).toEqual({ name: source.sourceName, index_url: source.sourceUrl })
    }
    await connection.client`INSERT INTO scraper_runs(started_at,status,finished_at) VALUES ('2020-01-01Z','passed','2020-01-01T00:01:00Z')`
    const before = await connection.client`SELECT * FROM scraper_runs ORDER BY id`
    expect(await seedDatabase(connection.client)).toMatchObject({ runsSeeded: 0, runsSkipped: 6 })
    expect(await connection.client`SELECT * FROM scraper_runs ORDER BY id`).toEqual(before)
    const history = await connection.client`SELECT * FROM article_history ORDER BY source_url`, sources = await connection.client`SELECT * FROM website_indexes ORDER BY id`
    await listScraperRuns({}, repo); await readScraperRun(list.items[0]!.id, repo)
    expect(await connection.client`SELECT * FROM article_history ORDER BY source_url`).toEqual(history)
    expect(await connection.client`SELECT * FROM website_indexes ORDER BY id`).toEqual(sources)
  })
  it('paginates and filters newest first with deterministic ID ties, returning empty and missing states', async () => {
    const repo = createScraperRunsRepository(connection.db)
    expect(await listScraperRuns({}, repo)).toMatchObject({ total: 0, items: [], page: 1 })
    await connection.client`INSERT INTO scraper_runs(started_at,status) SELECT '2026-11-01Z'::timestamptz, CASE WHEN number % 2=0 THEN 'running' ELSE 'passed' END FROM generate_series(1,27) number`
    const first = await listScraperRuns({}, repo), last = await listScraperRuns({ page: '99' }, repo)
    expect(first.items.map(run => run.id)).toEqual(Array.from({ length: 25 }, (_, i) => String(27 - i)))
    expect(last).toMatchObject({ page: 2, total: 27, items: [{ id: '2' }, { id: '1' }] })
    expect((await listScraperRuns({ status: 'running' }, repo)).total).toBe(13)
    await expect(readScraperRun('999', repo)).rejects.toMatchObject({ statusCode: 404 })
  })
  it('preserves historical metadata without registry rows and converts numeric JSON bigint IDs before JS decoding', async () => {
    const [run] = await connection.client`INSERT INTO scraper_runs(sources,extracted_opportunities) VALUES (
      jsonb_build_array(jsonb_build_object('website_index_id',9007199254740993::bigint,'source_name','Removed source','source_url','https://removed.gov.au','status','passed','discovered_count',2,'processed_count',2,'passed_count',2,'invalid_count',0,'failed_count',0,'skipped_count',0,'error',null)),
      jsonb_build_array(jsonb_build_object('website_index_id',9007199254740993::bigint,'source_name','Removed source','titles',ARRAY['Same title','Same title']))
    ) RETURNING id`
    const detail = await readScraperRun(String(run!.id), createScraperRunsRepository(connection.db))
    expect(detail.sources[0]).toMatchObject({ websiteIndexId: '9007199254740993', sourceName: 'Removed source' })
    expect(detail.extractedOpportunities[0]!.titles).toEqual(['Same title', 'Same title'])
    const [stored] = await connection.client`SELECT sources->0->>'website_index_id' AS id, jsonb_typeof(sources->0->'website_index_id') AS type FROM scraper_runs`
    expect(stored).toEqual({ id: '9007199254740993', type: 'number' })
    await connection.client`UPDATE scraper_runs SET status='interrupted',finished_at=now() WHERE id=${String(run!.id)}`
    expect((await readScraperRun(String(run!.id), createScraperRunsRepository(connection.db))).status).toBe('interrupted')
  })
  it('allows the fixed schema to store malformed JSON but exposes a controlled API error', async () => {
    const [row] = await connection.client`INSERT INTO scraper_runs(sources) VALUES ('{}'::jsonb) RETURNING id`
    await expect(readScraperRun(String(row!.id), createScraperRunsRepository(connection.db))).rejects.toMatchObject({ statusCode: 503 })
  })
})
