import { describe, expect, it, vi } from 'vitest'
import { listScraperRuns, readScraperRun, parseRunId, parseRunQuery } from '../../server/services/admin-scraper-runs'
import { storedRun, runSource } from '../support/scraper-run'
import { filterScraperRunSources, formatScraperRunTime, scraperRunDuration, scraperRunSourceUrl } from '../../app/utils/scraper-runs'

const repository = () => ({ list: vi.fn().mockResolvedValue({ rows: [storedRun()], total: 1, page: 1 }), detail: vi.fn().mockResolvedValue(storedRun()) })
describe('scraper run query and serialization', () => {
  it('accepts the four statuses and safe positive bigint IDs', () => {
    expect(parseRunQuery({})).toEqual({ page: 1 })
    for (const status of ['running', 'passed', 'failed', 'interrupted']) expect(parseRunQuery({ status, page: '2' })).toEqual({ status, page: 2 })
    expect(parseRunId('9223372036854775807')).toBe(9223372036854775807n)
  })
  it.each([{ status: '' }, { status: 'empty' }, { status: ['running'] }, { page: '0' }, { page: '1.5' }, { page: ['1'] }, { page: '9007199254740992' }])('rejects invalid queries before database work %j', async query => {
    const repo = repository()
    await expect(listScraperRuns(query, repo)).rejects.toMatchObject({ statusCode: 400 })
    expect(repo.list).not.toHaveBeenCalled()
  })
  it.each([undefined, '0', '-1', '1.5', '01', '9223372036854775808', ['1']])('rejects invalid IDs %j', async id => {
    const repo = repository()
    await expect(readScraperRun(id, repo)).rejects.toMatchObject({ statusCode: 400 })
    expect(repo.detail).not.toHaveBeenCalled()
  })
  it('serializes dates and precise IDs, computes totals, and preserves duplicate display titles', async () => {
    const repo = repository()
    const list = await listScraperRuns({}, repo)
    expect(list).toMatchObject({ total: 1, page: 1, pageSize: 25, items: [{ id: '9007199254740995',
      startedAt: '2026-11-01T03:00:00.000Z', sourceCount: 1, totals: { processedCount: 3, passedCount: 2, invalidCount: 1, skippedCount: 1 } }] })
    expect(list.items[0]).not.toHaveProperty('sources')
    const detail = await readScraperRun('9007199254740995', repo)
    expect(detail.sources[0]!.websiteIndexId).toBe('9007199254740993')
    expect(detail.extractedOpportunities[0]!.titles).toEqual(['Repeated title', 'Repeated title'])
    expect(() => JSON.stringify(detail)).not.toThrow()
  })
  it('retains partial successes and source-level failures without failed articles', async () => {
    const repo = repository()
    repo.detail.mockResolvedValue(storedRun({ status: 'failed', sources: [runSource({ status: 'failed', error: 'Discovery failed.', discovered_count: 0, processed_count: 0, passed_count: 0, invalid_count: 0, skipped_count: 0 })],
      extractedOpportunities: [{ website_index_id: '9007199254740993', source_name: 'Historical source', titles: [] }] }))
    const detail = await readScraperRun('1', repo)
    expect(detail.status).toBe('failed')
    expect(detail.sources[0]).toMatchObject({ status: 'failed', failedCount: 0, error: 'Discovery failed.' })
  })
  it('accepts empty running snapshots without inventing progress', async () => {
    const repo = repository()
    repo.detail.mockResolvedValue(storedRun({ status: 'running', finishedAt: null, sources: [], extractedOpportunities: [] }))
    expect(await readScraperRun('1', repo)).toMatchObject({ sourceCount: 0, finishedAt: null, sources: [], extractedOpportunities: [], totals: { passedCount: 0 } })
  })
  it('matches saved titles by ID, including when JSON arrays have different orders', async () => {
    const repo = repository()
    repo.detail.mockResolvedValue(storedRun({ sources: [runSource(), runSource({ website_index_id: '2', source_name: 'Second source' })],
      extractedOpportunities: [{ website_index_id: '2', source_name: 'Second source', titles: ['Second title', 'Other title'] },
        { website_index_id: '9007199254740993', source_name: 'Historical source', titles: ['Repeated title', 'Repeated title'] }] }))
    const detail = await readScraperRun('1', repo)
    expect(filterScraperRunSources(detail, 'second', 'passed', 'other')).toMatchObject([{ websiteIndexId: '2', titles: ['Other title'] }])
    expect(detail.totals.passedCount).toBe(4)
    expect(filterScraperRunSources(detail, '', 'failed', '')).toEqual([])
    expect(filterScraperRunSources(detail, '', '', 'unmatched')).toEqual([])
  })
  it.each([
    { sources: {} }, { sources: [runSource({ processed_count: -1 })] }, { sources: [runSource({ processed_count: 9 })] },
    { sources: [runSource(), runSource()] }, { sources: [runSource({ status: 'running' })] },
    { extractedOpportunities: [] }, { extractedOpportunities: [{ website_index_id: '1', source_name: 'Wrong', titles: [] }] },
    { status: 'unknown' }, { extractedOpportunities: {} }
  ])('handles malformed stored logs with a controlled generic error %j', async overrides => {
    const repo = repository(); repo.detail.mockResolvedValue(storedRun(overrides))
    await expect(readScraperRun('1', repo)).rejects.toMatchObject({ statusCode: 503, statusMessage: 'Scraper run logs are temporarily unavailable. Please try again.' })
  })
  it('distinguishes missing rows from configuration/database failures', async () => {
    const repo = repository(); repo.detail.mockResolvedValue(null)
    await expect(readScraperRun('1', repo)).rejects.toMatchObject({ statusCode: 404 })
    repo.detail.mockRejectedValue(new Error('private database info')); repo.list.mockRejectedValue(new Error('private configuration'))
    await expect(readScraperRun('1', repo)).rejects.toMatchObject({ statusCode: 503 })
    await expect(listScraperRuns({}, repo)).rejects.toMatchObject({ statusCode: 503 })
    repo.list.mockResolvedValue({ rows: [], total: 0, page: 1 })
    expect(await listScraperRuns({}, repo)).toEqual({ items: [], total: 0, page: 1, pageSize: 25 })
  })
})

describe('run presentation', () => {
  it('uses Melbourne daylight saving at each timestamp', () => {
    expect(formatScraperRunTime('2026-07-01T00:00:00Z')).toMatch(/10:00:00.*(?:AEST|GMT\+10)/)
    expect(formatScraperRunTime('2026-11-01T00:00:00Z')).toMatch(/11:00:00.*(?:AEDT|GMT\+11)/)
    expect(formatScraperRunTime(null)).toBe('Not recorded')
  })
  it('shows elapsed time without claiming liveness', () => {
    expect(scraperRunDuration({ startedAt: '2026-01-01T00:00:00Z', finishedAt: null, status: 'running' }, Date.parse('2026-01-01T01:01:02Z'))).toBe('1h 1m 2s since start')
    expect(scraperRunDuration({ startedAt: '2026-01-01T00:00:00Z', finishedAt: '2026-01-01T00:01:02Z', status: 'passed' }, 0)).toBe('1m 2s')
  })
  it('links only safe HTTPS snapshot URLs', () => {
    expect(scraperRunSourceUrl('https://example.gov.au')).toBe('https://example.gov.au/')
    for (const value of ['javascript:alert(1)', 'https://user:pass@example.gov.au', 'bad']) expect(scraperRunSourceUrl(value)).toBeUndefined()
  })
})
