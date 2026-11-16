import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import postgres from 'postgres'
import { eq, sql } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { connectDatabase } from '../../server/database'
import { articleHistory, opportunities, websiteIndexes } from '../../server/database/schema'
import { parseOpportunityDeadline } from '../../shared/utils/opportunity-deadline'
import { melbourneDateKey } from '../../shared/utils/melbourne-time'
import { createOpportunityRepository } from '../../server/utils/opportunity-repository'
import { createAdminOpportunityRepository } from '../../server/utils/admin-opportunity-repository'
import { createAdminOpportunityManagementRepository } from '../../server/utils/admin-opportunity-management-repository'
import { effectiveSubmissionDeadline } from '../../server/utils/opportunity-deadline-sql'
import { publishAdminOpportunity } from '../../server/services/admin-opportunities'
import { readAdminOpportunity, updateAdminOpportunity } from '../../server/services/admin-opportunity-management'
import { makeCreateOpportunity } from '../support/admin-opportunity'

const databaseUrl = process.env.TEST_DATABASE_URL
if (!databaseUrl) throw new Error('Use npm run test:database.')
type Connection = ReturnType<typeof connectDatabase>

describe('website Melbourne rules on the unchanged schema', () => {
  async function database(action: (connection: Connection) => Promise<void>) {
    const name = `echo_melbourne_test_${randomUUID().replaceAll('-', '')}`
    const control = postgres(databaseUrl!, { max: 1, onnotice: () => {} })
    let connection: Connection | undefined, created = false
    try {
      await control.unsafe(`CREATE DATABASE "${name}" TEMPLATE template0`); created = true
      const url = new URL(databaseUrl!); url.pathname = `/${name}`
      connection = connectDatabase(url.toString())
      await migrate(connection.db, { migrationsFolder: './drizzle' })
      await connection.db.insert(websiteIndexes).values({ name: 'Timezone source', indexUrl: 'https://example.gov.au' })
      await action(connection)
    } finally {
      if (connection) await connection.client.end({ timeout: 5 })
      if (created) await control.unsafe(`DROP DATABASE "${name}"`)
      await control.end({ timeout: 5 })
    }
  }
  async function insert(connection: Connection, id: string, deadline: string, precision: 'month' | 'datetime', opening: string | null = null) {
    await connection.db.insert(opportunities).values({ id, title: id, fullText: ['Stored content.'], sourceUrl: `https://example.gov.au/${id}`,
      websiteId: 1n, sourceOrg: 'Timezone source', jurisdiction: 'Victoria', category: ['Climate change'],
      submissionDeadline: new Date(deadline), submissionDeadlinePrecision: precision, startDate: opening ? new Date(opening) : null })
  }
  it('reads effective Melbourne instants without adding functions, constraints, defaults, or migrations', async () => database(async connection => {
    for (const month of ['0001-01', '1895-02', '2026-11', '2027-01', '2027-07', '9999-12']) {
      await insert(connection, month, `${month}-01T00:00:00Z`, 'month')
      const [row] = await connection.db.select({ millis: sql<string>`extract(epoch FROM ${effectiveSubmissionDeadline}) * 1000` })
        .from(opportunities).where(eq(opportunities.id, month))
      expect(Number(row?.millis)).toBe(parseOpportunityDeadline(month).getTime())
    }
    const [missing] = await connection.client`SELECT to_regprocedure('public.opportunity_effective_deadline(timestamptz,text)') AS function`
    expect(missing?.function).toBeNull()
    const [definition] = await connection.client`SELECT pg_get_expr(d.adbin,d.adrelid) AS expression FROM pg_attrdef d JOIN pg_attribute a ON a.attrelid=d.adrelid AND a.attnum=d.adnum WHERE a.attrelid='article_history'::regclass AND a.attname='upload_date'`
    expect(definition?.expression).toContain('UTC')
    expect(definition?.expression).not.toContain('Australia/Melbourne')
    const [constraint] = await connection.client`SELECT pg_get_constraintdef(oid) AS expression FROM pg_constraint WHERE conrelid='opportunities'::regclass AND conname='opportunities_date_order'`
    expect(constraint?.expression).toContain('start_date <= submission_deadline')
    expect(constraint?.expression).not.toContain('Australia/Melbourne')
    expect(await connection.client`SELECT * FROM drizzle.__drizzle_migrations`).toHaveLength(11)
  }))
  it('validates Melbourne openings in website writes while preserving the existing database rule', async () => database(async connection => {
    const publisher = createAdminOpportunityRepository(connection.db), manager = createAdminOpportunityManagementRepository(connection.db)
    // Existing database checks accept this stored-marker range; website validation is stricter.
    await insert(connection, 'external', '2026-11-01T00:00:00Z', 'month', '2026-10-31T23:00:00Z')
    const original = await readAdminOpportunity('external', manager)
    const input = { title: 'Website edit', fullText: original.opportunity.fullText, jurisdiction: original.opportunity.jurisdiction,
      category: original.opportunity.category, submissionDeadline: '2026-11', startDate: '2026-10-31T23:00:00Z', expectedVersion: original.version }
    await expect(publishAdminOpportunity(makeCreateOpportunity({ submissionDeadline: '2026-11', startDate: input.startDate }), publisher)).rejects.toMatchObject({ statusCode: 400 })
    await expect(updateAdminOpportunity('external', input, manager)).rejects.toMatchObject({ statusCode: 400 })
    expect((await manager.detail('external'))?.opportunity.startDate).toBe('2026-10-31T23:00:00.000Z')
    expect((await updateAdminOpportunity('external', { ...input, startDate: '2026-10-31T13:00:00Z' }, manager)).opportunity.startDate).toBe('2026-10-31T13:00:00.000Z')
  }))
  it('supplies Melbourne upload dates on website inserts and recovery without changing recorded dates', async () => database(async connection => {
    const publisher = createAdminOpportunityRepository(connection.db), manager = createAdminOpportunityManagementRepository(connection.db)
    await publisher.create(makeCreateOpportunity(), 'manual')
    expect((await connection.db.select().from(articleHistory))[0]?.uploadDate).toBe(melbourneDateKey(new Date()))
    const trackedUrl = 'https://example.gov.au/tracked'
    await connection.db.insert(articleHistory).values({ sourceUrl: trackedUrl, title: 'Tracked', uploadDate: '2020-02-29', hash: 'a'.repeat(64), sourceIndexId: 1n })
    await publisher.create(makeCreateOpportunity({ sourceUrl: trackedUrl }), 'tracked')
    expect((await connection.db.select().from(articleHistory).where(eq(articleHistory.sourceUrl, trackedUrl)))[0]).toMatchObject({ uploadDate: '2020-02-29', hash: 'a'.repeat(64) })
    for (const action of ['update', 'delete'] as const) {
      const id = `recover-${action}`, sourceUrl = `https://example.gov.au/${id}`
      await insert(connection, id, '2027-11-06T00:00:00Z', 'datetime')
      await connection.db.delete(articleHistory).where(eq(articleHistory.sourceUrl, sourceUrl))
      const detail = await readAdminOpportunity(id, manager)
      if (action === 'delete') await manager.delete(id, detail.version)
      else await manager.update(id, { title: id, fullText: ['Recovered history.'], jurisdiction: 'Victoria', category: ['Climate change'], startDate: null,
        submissionDeadline: detail.opportunity.submissionDeadline, expectedVersion: detail.version })
      expect((await connection.db.select().from(articleHistory).where(eq(articleHistory.sourceUrl, sourceUrl)))[0]).toMatchObject({ uploadDate: melbourneDateKey(new Date()), deleted: action === 'delete', sourceIndexId: 1n })
    }
  }))
  it('orders all readers before pagination and filters statuses at the Melbourne closing boundary', async () => database(async connection => {
    await insert(connection, 'a-exact', '2026-10-31T13:00:00Z', 'datetime')
    await insert(connection, 'middle', '2026-10-31T20:00:00Z', 'datetime')
    const months = Array.from({ length: 30 }, (_, index) => `z-month-${String(index).padStart(2, '0')}`)
    for (const id of months) await insert(connection, id, '2026-11-01T00:00:00Z', 'month')
    const expected = ['a-exact', ...months, 'middle'], publicReader = createOpportunityRepository(connection.db), admin = createAdminOpportunityManagementRepository(connection.db)
    expect((await publicReader.all()).map(row => row.opportunity.id)).toEqual(expected)
    expect((await publicReader.allForExport()).map(row => row.opportunity.id)).toEqual(expected)
    const query = { q: '', source: null, status: 'all' as const, deleted: false, page: 1 }
    expect((await admin.list(query)).items.map(row => row.opportunity.id)).toEqual(expected.slice(0, 25))
    expect((await admin.list({ ...query, page: 2 })).items.map(row => row.opportunity.id)).toEqual(expected.slice(25))
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(new Date('2026-10-31T12:59:59.999Z'))
      expect((await admin.list({ ...query, status: 'open' })).total).toBe(32)
      vi.setSystemTime(new Date('2026-10-31T13:00:00Z'))
      expect((await admin.list({ ...query, status: 'closed' })).total).toBe(31)
      expect((await admin.list({ ...query, status: 'open' })).items.map(row => row.opportunity.id)).toEqual(['middle'])
      vi.setSystemTime(new Date('2026-10-31T13:00:00.001Z'))
      expect((await admin.list({ ...query, status: 'closed' })).total).toBe(31)
    } finally { vi.useRealTimers() }
  }))
})
