import { randomUUID } from 'node:crypto'
import ExcelJS from 'exceljs'
import postgres from 'postgres'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { connectDatabase } from '../../server/database'
import { opportunities, websiteIndexes } from '../../server/database/schema'
import { createOpportunityRepository } from '../../server/utils/opportunity-repository'
import { exportOpportunities } from '../../server/services/opportunity-export'
import { seedDatabase } from '../../scripts/seed-database'

const databaseUrl = process.env.TEST_DATABASE_URL
if (!databaseUrl) throw new Error('Use npm run test:database.')

describe('database-backed opportunity export', () => {
  const name = `echo_export_test_${randomUUID().replaceAll('-', '')}`
  let control: ReturnType<typeof postgres>
  let connection: ReturnType<typeof connectDatabase>
  let created = false
  beforeAll(async () => {
    control = postgres(databaseUrl, { max: 1, onnotice: () => {} })
    await control.unsafe(`CREATE DATABASE "${name}" TEMPLATE template0`)
    created = true
    const url = new URL(databaseUrl); url.pathname = `/${name}`
    connection = connectDatabase(url.toString())
    await migrate(connection.db, { migrationsFolder: './drizzle' })
  })
  afterAll(async () => {
    if (connection) await connection.client.end({ timeout: 5 })
    if (created) await control.unsafe(`DROP DATABASE "${name}"`)
    if (control) await control.end({ timeout: 5 })
  })
  it('exports an empty database', async () => {
    const result = await exportOpportunities(createOpportunityRepository(connection.db))
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(Uint8Array.from(result.buffer).buffer)
    expect(workbook.worksheets[0]!.rowCount).toBe(1)
  })
  it('includes all seed and non-seed records with current source data in chronological, deterministic order', async () => {
    await seedDatabase(connection.client)
    const [source] = await connection.db.insert(websiteIndexes).values({ name: 'Disabled source',
      indexUrl: 'https://extra.gov.au', active: false, notes: 'Private source notes', tags: ['Invite-only'] }).returning()
    const base = { title: 'Extra listing', fullText: ['Extra text.'], sourceOrg: 'Another publisher', websiteId: source!.id,
      jurisdiction: 'Victoria' as const, submissionDeadline: new Date('2026-11-01T00:00:00Z'), category: ['Climate change' as const] }
    await connection.db.insert(opportunities).values([
      { ...base, id: 'z-extra', sourceUrl: 'https://extra.gov.au/z' },
      { ...base, id: 'a-extra', sourceUrl: 'https://extra.gov.au/a', submissionDeadlinePrecision: 'month' }
    ])
    const repository = createOpportunityRepository(connection.db)
    const rows = await repository.allForExport()
    expect(rows).toHaveLength(14)
    const expected = [...rows].sort((a, b) => a.opportunity.submissionDeadline.getTime() - b.opportunity.submissionDeadline.getTime()
      || (a.opportunity.id < b.opportunity.id ? -1 : a.opportunity.id > b.opportunity.id ? 1 : 0))
    expect(rows.map(row => row.opportunity.id)).toEqual(expected.map(row => row.opportunity.id))
    const ids = rows.map(row => row.opportunity.id)
    expect(ids.indexOf('a-extra')).toBeLessThan(ids.indexOf('z-extra'))
    expect(ids.indexOf('nature-repair-methods')).toBeLessThan(ids.indexOf('cultural-landscape-guidelines'))
    expect(rows.find(row => row.opportunity.id === 'a-extra')).toMatchObject({
      sourceName: 'Disabled source', indexUrl: 'https://extra.gov.au', sourceTags: ['Invite-only']
    })
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(Uint8Array.from((await exportOpportunities(repository)).buffer).buffer)
    const sheet = workbook.getWorksheet('Opportunities')!
    expect(sheet.rowCount).toBe(15)
    const index = ids.indexOf('a-extra') + 2
    expect(sheet.getCell(`D${index}`).value).toBe(source!.id.toString())
    expect(sheet.getCell(`M${index}`).value).toBe('Invite-only')
    expect(sheet.getCell(`N${index}`).value).toBe('Victoria')
    expect(JSON.stringify(sheet.getSheetValues())).not.toContain('Private source notes')
    await connection.client`UPDATE website_indexes SET name='Renamed', tags=ARRAY['New feature'] WHERE id=${source!.id.toString()}`
    expect((await repository.allForExport()).find(row => row.opportunity.id === 'a-extra'))
      .toMatchObject({ sourceName: 'Renamed', sourceTags: ['New feature'] })
  })
})
