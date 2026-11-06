import ExcelJS from 'exceljs'
import { describe, expect, it, vi } from 'vitest'
import { createOpportunityWorkbook, exportOpportunities, formatExportTimestamp, splitExportText,
  type OpportunityExportRow } from '../../server/services/opportunity-export'

function fixture(overrides: Partial<OpportunityExportRow['opportunity']> = {}): OpportunityExportRow {
  return { opportunity: {
    id: 'internal-id', title: '=SUM(A1:A2)', fullText: ['First paragraph.', 'Second paragraph.'],
    sourceUrl: 'https://example.gov.au/consultation', websiteId: 9007199254740993n,
    sourceOrg: 'Publishing organisation', jurisdiction: 'Victoria', startDate: null,
    submissionDeadline: new Date('2026-11-06T00:01:02.003Z'), submissionDeadlinePrecision: 'datetime',
    category: ['Climate change', 'Water & resources'], summary: null, location: null, ...overrides
  }, sourceName: '+Source name', indexUrl: 'https://example.gov.au', sourceTags: ['Invite-only', 'Login required'] }
}

async function readWorkbook(rows: OpportunityExportRow[]) {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(Uint8Array.from(await createOpportunityWorkbook(rows)).buffer)
  return workbook
}

describe('opportunity spreadsheet', () => {
  it('exports the agreed columns as literal text, preserving IDs, paragraphs, tags, and optional blanks', async () => {
    const workbook = await readWorkbook([fixture()])
    const sheet = workbook.getWorksheet('Opportunities')!
    expect(sheet.getRow(1).values).toEqual([undefined, 'Title', 'Publishing organisation', 'Jurisdiction',
      'Source ID', 'Source name', 'Index URL', 'Official consultation URL', 'Summary', 'Full text',
      'Opening date/time', 'Submission deadline', 'Categories', 'Source tags', 'Location'])
    expect(sheet.getRow(2).values).toEqual([undefined, '=SUM(A1:A2)', 'Publishing organisation', 'Victoria',
      '9007199254740993', '+Source name', 'https://example.gov.au', 'https://example.gov.au/consultation', '',
      'First paragraph.\n\nSecond paragraph.', '', '2026-11-06 11:01:02.003 UTC+11:00',
      'Climate change\nWater & resources', 'Invite-only\nLogin required', 'Victoria'])
    expect(sheet.getCell('A2').type).toBe(ExcelJS.ValueType.String)
    expect(sheet.getCell('D2').type).toBe(ExcelJS.ValueType.String)
    expect(sheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 })
    expect(sheet.autoFilter).toBe('A1:N1')
    expect(sheet.getCell('I2').alignment.wrapText).toBe(true)
    expect(JSON.stringify(sheet.getRow(2).values)).not.toContain('internal-id')
    expect(workbook.worksheets).toHaveLength(1)
  })
  it('preserves month deadlines, supplied summaries and labels; falls back for absent or blank labels', async () => {
    const location = { label: '  Melbourne  ', geometry: { type: 'Point' as const, coordinates: [145, -38] as [number, number] } }
    const workbook = await readWorkbook([
      fixture({ submissionDeadline: new Date('2026-11-01Z'), submissionDeadlinePrecision: 'month',
        startDate: new Date('2026-07-15T00:30:00Z'), summary: 'Summary.', location }),
      fixture({ jurisdiction: 'Commonwealth', location: { ...location, label: '  ' } })
    ])
    const sheet = workbook.worksheets[0]!
    expect(sheet.getCell('K2').value).toBe('2026-11')
    expect(sheet.getCell('J2').value).toBe('2026-07-15 10:30:00 UTC+10:00')
    expect(sheet.getCell('H2').value).toBe('Summary.')
    expect(sheet.getCell('N2').value).toBe('Melbourne')
    expect(sheet.getCell('N3').value).toBe('Commonwealth')
  })
  it('returns an empty, usable workbook with headers', async () => {
    const workbook = await readWorkbook([])
    expect(workbook.worksheets[0]!.rowCount).toBe(1)
    expect(workbook.worksheets[0]!.columnCount).toBe(14)
  })
  it('preserves oversized Unicode and many-line values using referenced, numbered chunks', async () => {
    const title = 'a'.repeat(32766) + '🌿' + 'b'.repeat(10)
    const fullText = Array.from({ length: 700 }, (_, i) => `Line ${i}: 🌏`).join('\n')
    const workbook = await readWorkbook([fixture({ title, fullText: [fullText] })])
    const sheet = workbook.worksheets[0]!
    expect(sheet.getCell('A2').value).toBe('See Long values: LV-1')
    expect(sheet.getCell('I2').value).toBe('See Long values: LV-2')
    const supplemental = workbook.getWorksheet('Long values')!
    const reconstructed: Record<string, string[]> = {}
    supplemental.eachRow((row, number) => {
      if (number === 1) return
      const key = String(row.getCell(1).value), part = Number(row.getCell(3).value), text = String(row.getCell(4).value)
      ;(reconstructed[key] ??= [])[part - 1] = text
      expect(text.length).toBeLessThanOrEqual(32767)
      expect(text.split('\n').length - 1).toBeLessThanOrEqual(253)
      expect(text).not.toMatch(/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/u)
    })
    expect(reconstructed['LV-1']!.join('')).toBe(title)
    expect(reconstructed['LV-2']!.join('')).toBe(fullText)
    expect(splitExportText('')).toEqual([''])
    expect(splitExportText('x'.repeat(32767))).toHaveLength(1)
    expect(splitExportText('\n'.repeat(254))).toEqual(['\n'.repeat(253), '\n'])
  })
})

describe('Melbourne export times', () => {
  it.each([
    ['2026-04-04T15:59:59Z', '2026-04-05 02:59:59 UTC+11:00'],
    ['2026-04-04T16:00:00Z', '2026-04-05 02:00:00 UTC+10:00'],
    ['2026-10-03T15:59:59Z', '2026-10-04 01:59:59 UTC+10:00'],
    ['2026-10-03T16:00:00Z', '2026-10-04 03:00:00 UTC+11:00'],
    ['2027-01-01T13:00:00Z', '2027-01-02 00:00:00 UTC+11:00']
  ])('formats %s with its own daylight saving offset', (input, expected) => {
    expect(formatExportTimestamp(new Date(input))).toBe(expected)
  })
  it('uses the Melbourne export date for the filename', async () => {
    const repository = { allForExport: vi.fn().mockResolvedValue([]) }
    const result = await exportOpportunities(repository, new Date('2026-11-06T14:00:00Z'))
    expect(result.filename).toBe('echo-opportunities-2026-11-07.xlsx')
    expect(result.buffer.subarray(0, 2).toString()).toBe('PK')
  })
  it('returns a generic 503 for database and workbook failures', async () => {
    await expect(exportOpportunities({ allForExport: async () => { throw new Error('secret connection string') } }))
      .rejects.toMatchObject({ statusCode: 503, statusMessage: 'Opportunity export is temporarily unavailable. Please try again.' })
    await expect(exportOpportunities({ allForExport: async () => [fixture({ startDate: new Date('invalid') })] }))
      .rejects.toMatchObject({ statusCode: 503 })
  })
})
