import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import postgres from 'postgres'
import { eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { connectDatabase } from '../../server/database'
import { articleHistory, opportunities, websiteIndexes } from '../../server/database/schema'
import { createAdminOpportunityRepository } from '../../server/utils/admin-opportunity-repository'
import { createAdminOpportunityManagementRepository } from '../../server/utils/admin-opportunity-management-repository'
import { deleteAdminOpportunity, listAdminOpportunities, readAdminOpportunity, updateAdminOpportunity } from '../../server/services/admin-opportunity-management'
import { publishAdminOpportunity } from '../../server/services/admin-opportunities'
import { createOpportunityRepository } from '../../server/utils/opportunity-repository'
import { createAdminWebsiteIndexRepository } from '../../server/utils/website-index-repository'
import { saveAdminWebsiteIndexes } from '../../server/services/admin-website-indexes'
import { readOpportunity } from '../../server/services/opportunities'
import { makeCreateOpportunity } from '../support/admin-opportunity'
import type { AdminOpportunityDetail, UpdateOpportunityRequest } from '../../shared/types/admin-opportunity-management'
import { melbourneDateTimeToUtc, melbourneInputsFromUtc } from '../../shared/utils/melbourne-time'

const databaseUrl = process.env.TEST_DATABASE_URL
if (!databaseUrl) throw new Error('Use npm run test:database.')
const boundary = { label: 'Existing boundary', geometry: { type: 'Polygon' as const, coordinates: [[[144, -38], [145, -38], [145, -37], [144, -38]] as [number, number][]] } }
function edit(detail: AdminOpportunityDetail, patch: Partial<UpdateOpportunityRequest> = {}): UpdateOpportunityRequest {
  const { title, fullText, summary, jurisdiction, startDate, submissionDeadline, category } = detail.opportunity
  return { title, fullText, summary, jurisdiction, startDate, submissionDeadline, category, expectedVersion: detail.version, ...patch }
}

describe('opportunity management in PostgreSQL', () => {
  const name = `echo_manage_test_${randomUUID().replaceAll('-', '')}`
  let admin: ReturnType<typeof postgres>
  let connection: ReturnType<typeof connectDatabase>
  let created = false
  let repository: ReturnType<typeof createAdminOpportunityManagementRepository>
  let publisher: ReturnType<typeof createAdminOpportunityRepository>
  let publicRepository: ReturnType<typeof createOpportunityRepository>
  beforeAll(async () => {
    admin = postgres(databaseUrl, { max: 1, onnotice: () => {} })
    await admin.unsafe(`CREATE DATABASE "${name}" TEMPLATE template0`)
    created = true
    const url = new URL(databaseUrl); url.pathname = `/${name}`
    connection = connectDatabase(url.toString())
    await migrate(connection.db, { migrationsFolder: './drizzle' })
    repository = createAdminOpportunityManagementRepository(connection.db)
    publisher = createAdminOpportunityRepository(connection.db)
    publicRepository = createOpportunityRepository(connection.db)
  })
  beforeEach(async () => {
    await connection.client`TRUNCATE opportunities, article_history, website_indexes RESTART IDENTITY`
    await connection.db.insert(websiteIndexes).values({ name: 'Test authority', indexUrl: 'https://example.gov.au', tags: ['Invite-only'], active: false, notes: 'Preserve notes' })
    await publisher.create(makeCreateOpportunity(), 'fixture')
    await connection.db.update(opportunities).set({ location: boundary }).where(eq(opportunities.id, 'fixture'))
    await connection.db.update(articleHistory).set({ title: 'Original scraped title', hash: 'a'.repeat(64), uploadDate: '2020-02-29' })
  })
  afterAll(async () => {
    if (connection) await connection.client.end({ timeout: 5 })
    if (created) await admin.unsafe(`DROP DATABASE "${name}"`)
    if (admin) await admin.end({ timeout: 5 })
  })
  it('saves edits publicly and in exports, preserving identity, boundaries, source fields, and all scrape metadata', async () => {
    const original = await readAdminOpportunity('fixture', repository)
    const history = await connection.db.select().from(articleHistory)
    const sources = await connection.db.select().from(websiteIndexes)
    const updated = await updateAdminOpportunity('fixture', edit(original, { title: 'Edited title', fullText: ['New paragraph.'], summary: 'New summary.',
      submissionDeadline: '2027-11', startDate: '2027-09-01T01:02:03.456Z', category: ['Water & resources'] }), repository)
    expect(updated.opportunity).toMatchObject({ id: 'fixture', title: 'Edited title', summary: 'New summary.', fullText: ['New paragraph.'],
      submissionDeadline: '2027-11', location: boundary, website: '1', sourceOrg: 'Test authority', sourceUrl: original.opportunity.sourceUrl })
    expect(updated.version).not.toBe(original.version)
    expect(await readOpportunity('fixture', publicRepository)).toMatchObject({ opportunity: updated.opportunity })
    expect((await publicRepository.allForExport())[0]?.opportunity).toMatchObject({ title: 'Edited title', submissionDeadlinePrecision: 'month' })
    expect(await connection.db.select().from(articleHistory)).toEqual(history)
    expect(await connection.db.select().from(websiteIndexes)).toEqual(sources)
  })
  it('can replace or explicitly remove a location and clear summary and opening date', async () => {
    const original = await readAdminOpportunity('fixture', repository)
    const updated = await updateAdminOpportunity('fixture', edit(original, { location: { label: 'New point', geometry: { type: 'Point', coordinates: [145, -38] } }, summary: 'Summary.', startDate: '2027-01-01T00:00:00Z' }), repository)
    expect(updated.opportunity.location?.geometry.type).toBe('Point')
    const cleared = await updateAdminOpportunity('fixture', edit(updated, { location: null, summary: '', startDate: null }), repository)
    expect(cleared.opportunity).not.toHaveProperty('location')
    expect(cleared.opportunity).not.toHaveProperty('summary')
    expect(cleared.opportunity.startDate).toBeNull()
  })
  it('persists converted Melbourne inputs in UTC and round-trips DST occurrences through creation and editing', async () => {
    const cases = [
      { date: '2027-01-15', time: '', utc: '2027-01-14T13:00:00.000Z' },
      { date: '2027-07-15', time: '17:00', utc: '2027-07-15T07:00:00.000Z' },
      { date: '2027-04-04', time: '02:30:12.345', utc: '2027-04-03T15:30:12.345Z' },
      { date: '2027-04-04', time: '02:30:12.345', utc: '2027-04-03T16:30:12.345Z' }
    ]
    for (const [index, item] of cases.entries()) {
      const deadline = melbourneDateTimeToUtc(item.date, item.time, item.utc)
      const opening = melbourneDateTimeToUtc('2027-01-01')
      await publisher.create(makeCreateOpportunity({ sourceUrl: `https://example.gov.au/local-${index}`, submissionDeadline: deadline, startDate: opening }), `local-${index}`)
      const saved = await readAdminOpportunity(`local-${index}`, repository)
      expect(saved.opportunity).toMatchObject({ submissionDeadline: item.utc, startDate: '2026-12-31T13:00:00.000Z' })
      const local = melbourneInputsFromUtc(saved.opportunity.submissionDeadline)
      const updated = await updateAdminOpportunity(`local-${index}`, edit(saved, { title: 'Edited local time', submissionDeadline: melbourneDateTimeToUtc(local.date, local.time, local.occurrence) }), repository)
      expect(updated.opportunity.submissionDeadline).toBe(item.utc)
      expect((await readOpportunity(`local-${index}`, publicRepository)).opportunity.submissionDeadline).toBe(item.utc)
      const [stored] = await connection.db.select().from(opportunities).where(eq(opportunities.id, `local-${index}`))
      expect(stored?.submissionDeadline.toISOString()).toBe(item.utc)
      expect(stored?.submissionDeadlinePrecision).toBe('datetime')
    }
  })
  it('hides deleted listings from every public read and export while retaining their full content for admins', async () => {
    const original = await readAdminOpportunity('fixture', repository)
    const stored = await connection.db.select().from(opportunities)
    const [history] = await connection.db.select().from(articleHistory)
    await deleteAdminOpportunity('fixture', { expectedVersion: original.version }, repository)
    expect(await connection.db.select().from(opportunities)).toEqual(stored)
    expect((await connection.db.select().from(articleHistory))[0]).toEqual({ ...history, deleted: true })
    const retained = await readAdminOpportunity('fixture', repository)
    expect(retained).toMatchObject({ deleted: true, opportunity: original.opportunity })
    expect(retained.version).not.toBe(original.version)
    expect(await publicRepository.all()).toEqual([])
    expect(await publicRepository.allForExport()).toEqual([])
    expect(await publicRepository.findById('fixture')).toBeNull()
    await expect(readOpportunity('fixture', publicRepository)).rejects.toMatchObject({ statusCode: 404 })
    expect((await listAdminOpportunities({}, repository)).total).toBe(0)
    expect((await listAdminOpportunities({ deleted: 'true' }, repository)).items[0]).toEqual(retained)
    await expect(updateAdminOpportunity('fixture', edit(retained), repository)).rejects.toMatchObject({ statusCode: 409 })
    await expect(deleteAdminOpportunity('fixture', { expectedVersion: retained.version }, repository)).rejects.toMatchObject({ statusCode: 409 })
  })
  it('blocks subsequent scraper updates and publication of a deleted URL', async () => {
    const original = await readAdminOpportunity('fixture', repository)
    await deleteAdminOpportunity('fixture', { expectedVersion: original.version }, repository)
    await expect(connection.db.update(opportunities).set({ title: 'Scraper overwrite' }).where(eq(opportunities.id, 'fixture'))).rejects.toMatchObject({ cause: { code: '23514' } })
    await expect(publishAdminOpportunity(makeCreateOpportunity(), publisher)).rejects.toMatchObject({ statusCode: 409 })
    expect((await repository.detail('fixture'))?.opportunity.title).toBe(original.opportunity.title)
  })
  it('keeps unrelated listings public and protects sources still referenced by retained content', async () => {
    await publisher.create(makeCreateOpportunity({ sourceUrl: 'https://example.gov.au/unrelated', title: 'Unrelated listing' }), 'unrelated')
    const original = await readAdminOpportunity('fixture', repository)
    await deleteAdminOpportunity('fixture', { expectedVersion: original.version }, repository)
    expect((await publicRepository.all()).map(row => row.opportunity.id)).toEqual(['unrelated'])
    expect((await publicRepository.allForExport()).map(row => row.opportunity.id)).toEqual(['unrelated'])
    // Even a source with only retained deleted opportunities remains referenced.
    const other = await readAdminOpportunity('unrelated', repository)
    await deleteAdminOpportunity('unrelated', { expectedVersion: other.version }, repository)
    await expect(saveAdminWebsiteIndexes({ upserts: [], deleteIds: ['1'] }, createAdminWebsiteIndexRepository(connection.db)))
      .rejects.toMatchObject({ statusCode: 409, data: { reason: 'source_in_use' } })
    expect(await connection.db.select().from(websiteIndexes)).toHaveLength(1)
  })
  it('rejects stale saves and deletions after a scraper or another admin edits the listing', async () => {
    const original = await readAdminOpportunity('fixture', repository)
    await connection.db.update(opportunities).set({ title: 'New scraper content' }).where(eq(opportunities.id, 'fixture'))
    await expect(updateAdminOpportunity('fixture', edit(original, { title: 'Stale edit' }), repository)).rejects.toMatchObject({ statusCode: 409 })
    await expect(deleteAdminOpportunity('fixture', { expectedVersion: original.version }, repository)).rejects.toMatchObject({ statusCode: 409 })
    expect((await repository.detail('fixture'))?.opportunity.title).toBe('New scraper content')
    expect((await connection.db.select().from(articleHistory))[0]?.deleted).toBe(false)
    const fresh = await readAdminOpportunity('fixture', repository)
    const results = await Promise.allSettled(['First edit', 'Second edit'].map(title => updateAdminOpportunity('fixture', edit(fresh, { title }), repository)))
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect((results.find(result => result.status === 'rejected') as PromiseRejectedResult).reason.statusCode).toBe(409)
  })
  it('serializes concurrent deletion and a scraper-style history-first transaction', async () => {
    const original = await readAdminOpportunity('fixture', repository)
    let release!: () => void, locked!: () => void
    const held = new Promise<void>(resolve => { locked = resolve })
    const continueScrape = new Promise<void>(resolve => { release = resolve })
    const scrape = connection.db.transaction(async tx => {
      await tx.select().from(articleHistory).where(eq(articleHistory.sourceUrl, original.opportunity.sourceUrl)).for('update')
      locked(); await continueScrape
      await tx.update(opportunities).set({ title: 'Concurrent scraper result' }).where(eq(opportunities.id, 'fixture'))
    })
    await held
    const deletion = deleteAdminOpportunity('fixture', { expectedVersion: original.version }, repository)
    release(); await scrape
    await expect(deletion).rejects.toMatchObject({ statusCode: 409 })
    expect((await repository.detail('fixture'))?.deleted).toBe(false)
  })
  it('rolls back missing-history recovery and failed writes atomically', async () => {
    const original = await readAdminOpportunity('fixture', repository)
    await connection.db.delete(articleHistory)
    await expect(repository.update('fixture', edit(original, { title: '' }))).rejects.toThrow()
    expect(await connection.db.select().from(articleHistory)).toEqual([])
    expect((await repository.detail('fixture'))?.opportunity.title).toBe(original.opportunity.title)
    await repository.delete('fixture', original.version)
    expect((await connection.db.select().from(articleHistory))[0]).toMatchObject({ deleted: true, sourceIndexId: 1n })
  })
  it('filters literal titles, source, and status; sorts before pagination with deterministic ties', async () => {
    for (let i = 0; i < 26; i++) await publisher.create(makeCreateOpportunity({ title: i === 0 ? 'Literal 100%_ title' : `Listing ${i}`,
      sourceUrl: `https://example.gov.au/item-${i}`, submissionDeadline: '2035-11', startDate: null }), `item-${String(i).padStart(2, '0')}`)
    await publisher.create(makeCreateOpportunity({ sourceUrl: 'https://example.gov.au/upcoming', submissionDeadline: '2036-11', startDate: '2036-09-01T00:00:00Z' }), 'upcoming')
    await publisher.create(makeCreateOpportunity({ sourceUrl: 'https://example.gov.au/closed', submissionDeadline: '2020-11' }), 'closed')
    const first = await listAdminOpportunities({}, repository)
    expect(first.total).toBe(29)
    expect(first.items.map(item => item.opportunity.id)).toEqual(['closed', 'fixture', ...Array.from({ length: 23 }, (_, i) => `item-${String(i).padStart(2, '0')}`)])
    expect((await listAdminOpportunities({ page: '2' }, repository)).items.map(item => item.opportunity.id)).toEqual(['item-23', 'item-24', 'item-25', 'upcoming'])
    expect((await listAdminOpportunities({ page: '999' }, repository)).page).toBe(2)
    expect((await listAdminOpportunities({ q: '%_' }, repository)).items.map(item => item.opportunity.id)).toEqual(['item-00'])
    expect((await listAdminOpportunities({ source: '999' }, repository)).total).toBe(0)
    expect((await listAdminOpportunities({ status: 'upcoming' }, repository)).items.map(item => item.opportunity.id)).toEqual(['upcoming'])
    expect((await listAdminOpportunities({ status: 'closed' }, repository)).items.map(item => item.opportunity.id)).toEqual(['closed'])
    expect((await listAdminOpportunities({ status: 'open' }, repository)).total).toBe(27)
  })
  it('distinguishes missing listings from deleted listings and detects changed source tags', async () => {
    await expect(readAdminOpportunity('unknown', repository)).rejects.toMatchObject({ statusCode: 404 })
    const original = await readAdminOpportunity('fixture', repository)
    await expect(updateAdminOpportunity('unknown', edit(original), repository)).rejects.toMatchObject({ statusCode: 404 })
    await expect(deleteAdminOpportunity('unknown', { expectedVersion: original.version }, repository)).rejects.toMatchObject({ statusCode: 404 })
    await connection.db.update(websiteIndexes).set({ tags: ['New source feature'] })
    await expect(updateAdminOpportunity('fixture', edit(original), repository)).rejects.toMatchObject({ statusCode: 409 })
  })
})
