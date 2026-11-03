import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import postgres from 'postgres'
import { eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { connectDatabase } from '../../server/database'
import { articleHistory, opportunities, websiteIndexes } from '../../server/database/schema'
import { createAdminOpportunityRepository } from '../../server/utils/admin-opportunity-repository'
import { publishAdminOpportunity, readAdminOpportunityOptions } from '../../server/services/admin-opportunities'
import { createOpportunityRepository } from '../../server/utils/opportunity-repository'
import { listOpportunities, readOpportunity } from '../../server/services/opportunities'
import { createAdminWebsiteIndexRepository } from '../../server/utils/website-index-repository'
import { saveAdminWebsiteIndexes } from '../../server/services/admin-website-indexes'
import { makeCreateOpportunity } from '../support/admin-opportunity'

const databaseUrl = process.env.TEST_DATABASE_URL
if (!databaseUrl) throw new Error('Use npm run test:database.')
const newOrganisation = { newSource: { name: 'New authority', indexUrl: 'https://new.example.gov.au/consultations' } }
describe('manual opportunity publication in PostgreSQL', () => {
  const name = `echo_create_test_${randomUUID().replaceAll('-', '')}`
  let admin: ReturnType<typeof postgres>
  let connection: ReturnType<typeof connectDatabase>
  let created = false
  let repository: ReturnType<typeof createAdminOpportunityRepository>
  beforeAll(async () => {
    admin = postgres(databaseUrl, { max: 1, onnotice: () => {} })
    await admin.unsafe(`CREATE DATABASE "${name}" TEMPLATE template0`)
    created = true
    const url = new URL(databaseUrl); url.pathname = `/${name}`
    connection = connectDatabase(url.toString())
    await migrate(connection.db, { migrationsFolder: './drizzle' })
    repository = createAdminOpportunityRepository(connection.db)
  })
  beforeEach(async () => {
    await connection.client`TRUNCATE opportunities, article_history, website_indexes RESTART IDENTITY`
    await connection.db.insert(websiteIndexes).values({ name: 'Test authority', indexUrl: 'https://example.gov.au/consultations', active: false, notes: 'Keep these notes' })
  })
  afterAll(async () => {
    if (connection) await connection.client.end({ timeout: 5 })
    if (created) await admin.unsafe(`DROP DATABASE "${name}"`)
    if (admin) await admin.end({ timeout: 5 })
  })
  async function associate(websiteId: bigint, suffix: string) {
    const sourceUrl = `https://example.gov.au/${suffix}`
    await connection.db.insert(articleHistory).values({ sourceUrl, title: 'Existing article', sourceIndexId: 1n })
    await connection.db.insert(opportunities).values({ id: suffix, sourceUrl, title: 'Existing article', fullText: ['Content.'],
      websiteId, sourceOrg: 'Existing publisher', jurisdiction: 'Victoria', category: ['Climate change'],
      submissionDeadline: new Date('2027-11-06T00:00:00Z') })
  }
  it('loads actual sources including inactive and duplicate names, with resolved features and no writes', async () => {
    await connection.db.update(websiteIndexes).set({ tags: ['Login required'] }).where(eq(websiteIndexes.id, 1n))
    await connection.db.insert(websiteIndexes).values({ name: 'Test authority', indexUrl: 'https://other.gov.au/consultations' })
    expect(await readAdminOpportunityOptions(repository)).toEqual({ sources: [
      { id: '1', name: 'Test authority', indexUrl: 'https://example.gov.au/consultations', active: false, websiteTags: ['Login required'] },
      { id: '2', name: 'Test authority', indexUrl: 'https://other.gov.au/consultations', active: true, websiteTags: [] }
    ] })
    await connection.db.delete(websiteIndexes)
    expect(await readAdminOpportunityOptions(repository)).toEqual({ sources: [] })
  })
  it('links an inactive source and derives the publisher name from its current database record', async () => {
    await connection.db.update(websiteIndexes).set({ name: 'Renamed authority' }).where(eq(websiteIndexes.id, 1n))
    const before = await connection.db.select().from(websiteIndexes)
    const result = await publishAdminOpportunity(makeCreateOpportunity(), repository)
    expect(result.opportunity).toMatchObject({ sourceOrg: 'Renamed authority', website: '1' })
    expect(result.websiteTags).toEqual([])
    const publicRepository = createOpportunityRepository(connection.db)
    expect(await readOpportunity(result.opportunity.id, publicRepository)).toEqual(result)
    expect(await listOpportunities(publicRepository)).toEqual([result.opportunity])
    expect(await connection.db.select().from(websiteIndexes)).toEqual(before)
    const [history] = await connection.db.select().from(articleHistory)
    expect(history).toMatchObject({ sourceUrl: result.opportunity.sourceUrl, hash: null, sourceIndexId: 1n, deleted: false })
    expect(history?.uploadDate).toBe(new Date().toISOString().slice(0, 10))
  })
  it('reads source features directly without changing existing listings', async () => {
    await connection.db.update(websiteIndexes).set({ tags: ['Login required'] }).where(eq(websiteIndexes.id, 1n))
    await associate(1n, 'existing')
    const before = await connection.db.select().from(opportunities)
    const result = await publishAdminOpportunity(makeCreateOpportunity(), repository)
    expect(result).toMatchObject({ opportunity: { website: '1' }, websiteTags: ['Login required'] })
    expect((await connection.db.select().from(opportunities)).find(row => row.id === 'existing')).toEqual(before[0])
  })
  it('reflects feature edits directly in options and later publication', async () => {
    await connection.db.update(websiteIndexes).set({ tags: ['Online submission'] }).where(eq(websiteIndexes.id, 1n))
    expect((await repository.options()).sources[0]?.websiteTags).toEqual(['Online submission'])
    const result = await publishAdminOpportunity(makeCreateOpportunity(), repository)
    expect(result).toMatchObject({ opportunity: { website: '1' }, websiteTags: ['Online submission'] })
  })
  it('reuses the source ID for subsequent publications and preview features', async () => {
    const first = await publishAdminOpportunity(makeCreateOpportunity(), repository)
    const second = await publishAdminOpportunity(makeCreateOpportunity({ sourceUrl: 'https://example.gov.au/another' }), repository)
    expect(first.opportunity.website).toBe(second.opportunity.website)
    expect((await repository.options()).sources[0]?.websiteTags).toEqual(first.websiteTags)
  })
  it('atomically creates a disabled source, linked history, month-only listing, and map point', async () => {
    const result = await publishAdminOpportunity(makeCreateOpportunity({ organisation: newOrganisation,
      submissionDeadline: '2027-11', startDate: '2027-09-01T12:00:00Z', tags: ['science', 'SCIENCE', 'invite-only'],
      location: { label: 'Melbourne', geometry: { type: 'Point', coordinates: [144.9631, -37.8136] } }
    }), repository)
    expect(result).toMatchObject({ opportunity: { website: '2', sourceOrg: 'New authority', submissionDeadline: '2027-11',
      tags: ['science', 'Invite-only'], startDate: '2027-09-01T12:00:00.000Z', location: { label: 'Melbourne' } }, websiteTags: [] })
    expect((await connection.db.select().from(websiteIndexes)).find(row => row.id === 2n)).toMatchObject({ ...newOrganisation.newSource, active: false, notes: null })
    expect((await connection.db.select().from(articleHistory))[0]?.sourceIndexId).toBe(2n)
    const [row] = await connection.db.select().from(opportunities)
    expect(row?.submissionDeadline.toISOString()).toBe('2027-11-01T00:00:00.000Z')
    expect(row?.submissionDeadlinePrecision).toBe('month')
  })
  it('rejects duplicate URLs and rolls back a new source without overwriting content or history', async () => {
    const original = await publishAdminOpportunity(makeCreateOpportunity(), repository)
    const history = await connection.db.select().from(articleHistory)
    await expect(publishAdminOpportunity(makeCreateOpportunity({ title: 'Overwrite attempt', organisation: newOrganisation }), repository))
      .rejects.toMatchObject({ statusCode: 409, data: { opportunityId: original.opportunity.id } })
    expect(await connection.db.select().from(websiteIndexes)).toHaveLength(1)
    expect((await connection.db.select().from(opportunities))[0]?.title).toBe(original.opportunity.title)
    expect(await connection.db.select().from(articleHistory)).toEqual(history)
  })
  it('rejects deleted URLs without clearing metadata or leaving a newly requested source behind', async () => {
    await connection.db.insert(articleHistory).values({ sourceUrl: makeCreateOpportunity().sourceUrl, title: 'Deleted',
      hash: 'a'.repeat(64), uploadDate: '2020-02-29', deleted: true, sourceIndexId: 1n })
    const before = await connection.db.select().from(articleHistory)
    await expect(publishAdminOpportunity(makeCreateOpportunity({ organisation: newOrganisation }), repository)).rejects.toMatchObject({ statusCode: 409 })
    expect(await connection.db.select().from(articleHistory)).toEqual(before)
    expect(await connection.db.select().from(opportunities)).toEqual([])
    expect(await connection.db.select().from(websiteIndexes)).toHaveLength(1)
  })
  it.each([null, 1n])('links tracked history with source %s while preserving scrape metadata', async sourceIndexId => {
    await connection.db.insert(articleHistory).values({ sourceUrl: makeCreateOpportunity().sourceUrl, title: 'Old title',
      hash: 'b'.repeat(64), uploadDate: '2020-02-29', sourceIndexId })
    await publishAdminOpportunity(makeCreateOpportunity(), repository)
    expect((await connection.db.select().from(articleHistory))[0]).toMatchObject({ title: 'Manual consultation', hash: 'b'.repeat(64),
      uploadDate: '2020-02-29', sourceIndexId: 1n, deleted: false })
  })
  it('rejects conflicting history source associations atomically', async () => {
    const [other] = await connection.db.insert(websiteIndexes).values({ name: 'Other', indexUrl: 'https://other.gov.au' }).returning()
    await connection.db.insert(articleHistory).values({ sourceUrl: makeCreateOpportunity().sourceUrl, title: 'Tracked', sourceIndexId: other!.id })
    const before = await connection.db.select().from(articleHistory)
    await expect(publishAdminOpportunity(makeCreateOpportunity(), repository)).rejects.toMatchObject({ statusCode: 409 })
    expect(await connection.db.select().from(articleHistory)).toEqual(before)
    expect(await connection.db.select().from(opportunities)).toEqual([])
  })
  it('creates new organisations after the root registry seed and preserves later IDs on rerun', async () => {
    const seed = await readFile(new URL('../../seed.sql', import.meta.url), 'utf8')
    await connection.client.unsafe(seed).simple()
    const first = await publishAdminOpportunity(makeCreateOpportunity({ organisation: newOrganisation }), repository)
    expect(first.opportunity.website).toBe('42')
    await connection.db.update(websiteIndexes).set({ tags: ['Keep custom feature'] }).where(eq(websiteIndexes.id, 25n))
    await connection.client.unsafe(seed).simple()
    expect((await connection.db.select().from(websiteIndexes).where(eq(websiteIndexes.id, 25n)))[0]?.tags).toEqual(['Keep custom feature'])
    const second = await publishAdminOpportunity(makeCreateOpportunity({ sourceUrl: 'https://new.example.gov.au/another',
      organisation: { newSource: { name: 'Another authority', indexUrl: 'https://another.example.gov.au/consultations' } } }), repository)
    expect(second.opportunity.website).toBe('44')
    expect((await connection.db.select().from(websiteIndexes)).find(row => row.id === 42n)?.active).toBe(false)
  })
  it('edits source features, preserves omitted tags, and rejects referenced-source deletion atomically', async () => {
    const result = await publishAdminOpportunity(makeCreateOpportunity(), repository)
    const indexes = createAdminWebsiteIndexRepository(connection.db)
    const update = { id: '1', expectedActive: false, name: 'Test authority', indexUrl: 'https://example.gov.au/consultations', active: false, notes: 'Keep notes' }
    await saveAdminWebsiteIndexes({ upserts: [{ ...update, tags: [' Login required ', 'login required', 'Online submission'] }], deleteIds: [] }, indexes)
    await saveAdminWebsiteIndexes({ upserts: [{ ...update, notes: 'Changed notes' }], deleteIds: [] }, indexes)
    expect((await readOpportunity(result.opportunity.id, createOpportunityRepository(connection.db))).websiteTags).toEqual(['Login required', 'Online submission'])
    await expect(saveAdminWebsiteIndexes({ upserts: [{ name: 'Must roll back', indexUrl: 'https://rollback.gov.au', active: false, notes: null }], deleteIds: ['1'] }, indexes))
      .rejects.toMatchObject({ statusCode: 409, data: { reason: 'source_in_use' } })
    expect(await indexes.all()).toHaveLength(1)
    expect((await indexes.all())[0]).toMatchObject({ active: false, notes: 'Changed notes', tags: ['Login required', 'Online submission'] })
  })
  it.each([
    { tags: null, code: '23502' }, { tags: [' '], code: '23514' }, { tags: [' padded'], code: '23514' },
    { tags: ['Label', 'label'], code: '23514' }, { tags: [null], code: '23514' }, { tags: [['Nested']], code: '23514' }
  ])('rejects invalid source feature arrays $tags', async ({ tags, code }) => {
    await expect(connection.client`UPDATE website_indexes SET tags=${tags}::text[] WHERE id=1`).rejects.toMatchObject({ code })
  })
  it('reports vanished selections without creating records', async () => {
    await expect(publishAdminOpportunity(makeCreateOpportunity({ organisation: { existingId: '999' } }), repository)).rejects.toMatchObject({ statusCode: 409 })
    expect(await connection.db.select().from(articleHistory)).toEqual([])
    expect(await connection.db.select().from(opportunities)).toEqual([])
  })
  it('serializes concurrent publication of the same URL and rolls back the losing source', async () => {
    const results = await Promise.allSettled(['First', 'Second'].map(name => publishAdminOpportunity(makeCreateOpportunity({ organisation: { newSource: { ...newOrganisation.newSource, name } } }), repository)))
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect((results.find(result => result.status === 'rejected') as PromiseRejectedResult).reason.statusCode).toBe(409)
    expect(await connection.db.select().from(opportunities)).toHaveLength(1)
    expect(await connection.db.select().from(articleHistory)).toHaveLength(1)
    expect(await connection.db.select().from(websiteIndexes)).toHaveLength(2)
  })
  it('rolls back new sources and history if a later opportunity constraint fails', async () => {
    const result = await publishAdminOpportunity(makeCreateOpportunity(), repository)
    const before = await connection.db.select().from(articleHistory)
    await expect(repository.create(makeCreateOpportunity({ sourceUrl: 'https://example.gov.au/other', organisation: newOrganisation }), result.opportunity.id)).rejects.toThrow()
    expect(await connection.db.select().from(articleHistory)).toEqual(before)
    expect(await connection.db.select().from(websiteIndexes)).toHaveLength(1)
    expect(await connection.db.select().from(opportunities)).toHaveLength(1)
  })
})
