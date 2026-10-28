import { describe, expect, it, vi } from 'vitest'
import {
  buildScraperSourceUpdates, createScraperSnapshot, parseScraperSnapshot, restoreScraperSnapshot,
  scraperSnapshotKey, scraperSourceDrafts, storeScraperSnapshot, isScraperTab
} from '../../app/utils/scraper-source-state'

const sources = [
  { id: '1', name: 'One', indexUrl: 'https://one.example', active: true, articleCount: 1 },
  { id: '2', name: 'Two', indexUrl: 'https://two.example', active: false, articleCount: 0 }
]
const captured = new Date('2026-10-28T00:00:00Z')
describe('scraper source draft and browser backup', () => {
  it('sends only changed settings with their original persisted flags, without mutating fetched data', () => {
    const drafts = scraperSourceDrafts(sources)
    expect(buildScraperSourceUpdates(drafts)).toEqual({ updates: [] })
    drafts[1]!.active = true
    expect(buildScraperSourceUpdates(drafts)).toEqual({ updates: [{ id: '2', active: true, expectedActive: false }] })
    expect(sources[1]!.active).toBe(false)
  })
  it('backs up unsaved visible choices and restores them without altering the save baseline', () => {
    const drafts = scraperSourceDrafts(sources)
    drafts[0]!.active = false
    const backup = createScraperSnapshot(drafts, captured)
    const bulk = drafts.map(source => ({ ...source, active: true }))
    const restored = restoreScraperSnapshot(bulk, backup)
    expect(restored.sources.map(source => source.active)).toEqual([false, false])
    expect(buildScraperSourceUpdates(restored.sources)).toEqual({ updates: [{ id: '1', active: false, expectedActive: true }] })
    expect(bulk.every(source => source.active)).toBe(true)
  })
  it('restores matching identities only, skipping removed or URL-changed sources and retaining new ones', () => {
    const backup = createScraperSnapshot(scraperSourceDrafts(sources), captured)
    const drafts = scraperSourceDrafts([
      { ...sources[0]!, active: false }, { ...sources[1]!, indexUrl: 'https://changed.example', active: true },
      { ...sources[1]!, id: '3', active: true }
    ])
    expect(restoreScraperSnapshot(drafts, backup)).toMatchObject({ restored: 1, skipped: 1 })
    expect(restoreScraperSnapshot(drafts, backup).sources.map(source => source.active)).toEqual([true, true, true])
    expect(restoreScraperSnapshot([], backup)).toMatchObject({ restored: 0, skipped: 2 })
  })
  it('round-trips a versioned snapshot and scopes storage to each administrator', () => {
    const backup = createScraperSnapshot(scraperSourceDrafts(sources), captured)
    expect(parseScraperSnapshot(JSON.stringify(backup))).toEqual(backup)
    expect(scraperSnapshotKey(1)).not.toBe(scraperSnapshotKey(2))
    expect(() => scraperSnapshotKey(0)).toThrow()
  })
  it.each(['bad json', 'null', '{}', '{"version":2}', JSON.stringify({ version: 1, capturedAt: 'bad', sources: [] }),
    JSON.stringify({ version: 1, capturedAt: captured.toISOString(), sources: [{ id: '0', indexUrl: 'https://one.example', active: true }] }),
    JSON.stringify({ version: 1, capturedAt: captured.toISOString(), sources: [{ id: '1', indexUrl: 'javascript:alert(1)', active: true }] })
  ])('ignores malformed or unsupported stored data: %s', raw => {
    expect(parseScraperSnapshot(raw)).toBeNull()
  })
  it('rejects duplicate entries and non-boolean flags in stored data', () => {
    const backup = createScraperSnapshot(scraperSourceDrafts(sources), captured)
    expect(parseScraperSnapshot(JSON.stringify({ ...backup, sources: [backup.sources[0], backup.sources[0]] }))).toBeNull()
    expect(parseScraperSnapshot(JSON.stringify({ ...backup, sources: [{ ...backup.sources[0], active: 'true' }] }))).toBeNull()
  })
  it('verifies browser persistence and reports failed or silently discarded writes', () => {
    const backup = createScraperSnapshot(scraperSourceDrafts(sources), captured)
    const storage = new Map<string, string>()
    storeScraperSnapshot({ getItem: key => storage.get(key) ?? null, setItem: (key, value) => { storage.set(key, value) } }, 'test', backup)
    expect(parseScraperSnapshot(storage.get('test')!)).toEqual(backup)
    expect(() => storeScraperSnapshot({ getItem: () => null, setItem: vi.fn() }, 'test', backup)).toThrow()
    expect(() => storeScraperSnapshot({ getItem: () => null, setItem: () => { throw new Error('Quota exceeded') } }, 'test', backup)).toThrow('Quota exceeded')
  })
  it('recognizes only the scraper panel and its existing aliases when guarding tab navigation', () => {
    expect(['scraper', 'articles', 'submissions'].every(isScraperTab)).toBe(true)
    expect(['indexes', 'pages', undefined, ['scraper']].some(isScraperTab)).toBe(false)
  })
})
