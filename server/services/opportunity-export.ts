import ExcelJS from 'exceljs'
import { createError } from 'h3'
import type { OpportunityRecord } from '../database/schema'
import { serializeOpportunityDeadline } from '../../shared/utils/opportunity-deadline'

export interface OpportunityExportRow {
  opportunity: OpportunityRecord
  sourceName: string
  indexUrl: string
  sourceTags: string[]
}

export interface OpportunityExportRepository {
  allForExport(): Promise<OpportunityExportRow[]>
}

const melbourne = new Intl.DateTimeFormat('en-AU', {
  timeZone: 'Australia/Melbourne', calendar: 'gregory', numberingSystem: 'latn',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit',
  minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZoneName: 'longOffset'
})

function dateParts(value: Date) {
  const parts = Object.fromEntries(melbourne.formatToParts(value).map(part => [part.type, part.value]))
  return { date: `${parts.year!.padStart(4, '0')}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}:${parts.second}`,
    offset: parts.timeZoneName!.replace('GMT', 'UTC') }
}

export function formatExportTimestamp(value: Date): string {
  const { date, time, offset } = dateParts(value)
  const milliseconds = value.getUTCMilliseconds()
  return `${date} ${time}${milliseconds ? `.${String(milliseconds).padStart(3, '0')}` : ''} ${offset}`
}

// Excel limits each cell to 32,767 UTF-16 characters and 253 line feeds.
// Iterate by code point so a supplemental chunk never splits a surrogate pair.
export function splitExportText(value: string): string[] {
  const chunks: string[] = []
  let chunk = ''
  let lineFeeds = 0
  for (const character of value) {
    if (chunk.length + character.length > 32767 || (character === '\n' && lineFeeds === 253)) {
      chunks.push(chunk)
      chunk = ''
      lineFeeds = 0
    }
    chunk += character
    if (character === '\n') lineFeeds++
  }
  if (chunk || !chunks.length) chunks.push(chunk)
  return chunks
}

const columns = [
  ['Title', 42], ['Publishing organisation', 32], ['Jurisdiction', 20], ['Source ID', 22],
  ['Source name', 32], ['Index URL', 45], ['Official consultation URL', 45], ['Summary', 55],
  ['Full text', 65], ['Opening date/time', 35], ['Submission deadline', 35],
  ['Categories', 30], ['Source tags', 25], ['Location', 32]
] as const

function prepareSheet(sheet: ExcelJS.Worksheet, headings: readonly (readonly [string, number])[]) {
  sheet.columns = headings.map(([header, width]) => ({ header, width, style: {
    numFmt: '@', alignment: { vertical: 'top' as const, wrapText: true }
  } }))
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
  sheet.getRow(1).font = { bold: true }
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headings.length } }
}

export async function createOpportunityWorkbook(rows: OpportunityExportRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Opportunities')
  prepareSheet(sheet, columns)
  let longValues: ExcelJS.Worksheet | undefined
  let reference = 0
  const cellText = (value: string, field: string): string => {
    const chunks = splitExportText(value)
    if (chunks.length === 1) return value
    if (!longValues) {
      longValues = workbook.addWorksheet('Long values')
      prepareSheet(longValues, [['Reference', 20], ['Field', 28], ['Part', 12], ['Text', 100]])
    }
    const key = `LV-${++reference}`
    for (const [index, chunk] of chunks.entries()) {
      if (longValues.rowCount >= 1048576) throw new Error('Workbook row limit exceeded')
      longValues.addRow([key, field, String(index + 1), chunk])
    }
    return `See Long values: ${key}`
  }
  for (const { opportunity: row, sourceName, indexUrl, sourceTags } of rows) {
    if (sheet.rowCount >= 1048576) throw new Error('Workbook row limit exceeded')
    const values = [row.title, row.sourceOrg, row.jurisdiction, row.websiteId.toString(),
      sourceName, indexUrl, row.sourceUrl, row.summary ?? '', row.fullText.join('\n\n'),
      row.startDate ? formatExportTimestamp(row.startDate) : '',
      row.submissionDeadlinePrecision === 'month'
        ? serializeOpportunityDeadline(row.submissionDeadline, 'month')
        : formatExportTimestamp(row.submissionDeadline),
      row.category.join('\n'), sourceTags.join('\n'), row.location?.label.trim() || row.jurisdiction]
    sheet.addRow(values.map((value, index) => cellText(value, columns[index]![0])))
  }
  return Buffer.from(await workbook.xlsx.writeBuffer())
}

export async function exportOpportunities(repository: OpportunityExportRepository, now = new Date()) {
  try {
    const buffer = await createOpportunityWorkbook(await repository.allForExport())
    return { buffer, filename: `echo-opportunities-${dateParts(now).date}.xlsx` }
  } catch {
    throw createError({ statusCode: 503, statusMessage: 'Opportunity export is temporarily unavailable. Please try again.' })
  }
}
