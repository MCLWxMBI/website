import type { AdminScraperSource, UpdateScraperSourcesRequest } from '~~/shared/types/admin-scraper'

export interface ScraperSourceDraft extends AdminScraperSource {
  expectedActive: boolean
}
export interface ScraperSourceSnapshot {
  version: 1
  capturedAt: string
  sources: { id: string; indexUrl: string; active: boolean }[]
}

export function scraperSourceDrafts(sources: AdminScraperSource[]): ScraperSourceDraft[] {
  return sources.map(source => ({ ...source, expectedActive: source.active }))
}

export function buildScraperSourceUpdates(drafts: ScraperSourceDraft[], paused = false): UpdateScraperSourcesRequest {
  return { updates: drafts.map(({ id, active, expectedActive }) => ({ id, active: paused ? false : active, expectedActive }))
    .filter(source => source.active !== source.expectedActive) }
}

export function createScraperSnapshot(drafts: ScraperSourceDraft[], now = new Date()): ScraperSourceSnapshot {
  return { version: 1, capturedAt: now.toISOString(), sources: drafts.map(({ id, indexUrl, active }) => ({ id, indexUrl, active })) }
}

export function parseScraperSnapshot(raw: string | null): ScraperSourceSnapshot | null {
  if (!raw) return null
  try {
    const snapshot = JSON.parse(raw)
    if (!snapshot || snapshot.version !== 1 || typeof snapshot.capturedAt !== 'string'
      || !Number.isFinite(Date.parse(snapshot.capturedAt)) || !Array.isArray(snapshot.sources)) return null
    const seen = new Set<string>()
    for (const source of snapshot.sources) {
      if (!source || typeof source.id !== 'string' || !/^[1-9]\d{0,18}$/.test(source.id)
        || BigInt(source.id) > BigInt('9223372036854775807') || seen.has(source.id)
        || typeof source.indexUrl !== 'string' || new URL(source.indexUrl).protocol !== 'https:'
        || typeof source.active !== 'boolean') return null
      seen.add(source.id)
    }
    return { version: 1, capturedAt: snapshot.capturedAt, sources: snapshot.sources.map(
      (source: ScraperSourceSnapshot['sources'][number]) => ({ id: source.id, indexUrl: source.indexUrl, active: source.active })
    ) }
  } catch { return null }
}

export function restoreScraperSnapshot(drafts: ScraperSourceDraft[], snapshot: ScraperSourceSnapshot) {
  const saved = new Map(snapshot.sources.map(source => [source.id, source]))
  let restored = 0
  const sources = drafts.map(source => {
    const previous = saved.get(source.id)
    if (!previous || previous.indexUrl !== source.indexUrl) return { ...source }
    restored++
    return { ...source, active: previous.active }
  })
  return { sources, restored, skipped: snapshot.sources.length - restored }
}

export function scraperSnapshotKey(administratorId: number) {
  if (!Number.isSafeInteger(administratorId) || administratorId <= 0) throw new Error('An administrator is required.')
  return `echo.scraper.sources.snapshot.v1:${administratorId}`
}

export function storeScraperSnapshot(storage: Pick<Storage, 'getItem' | 'setItem'>, key: string, snapshot: ScraperSourceSnapshot) {
  const value = JSON.stringify(snapshot)
  storage.setItem(key, value)
  if (storage.getItem(key) !== value) throw new Error('The browser did not save the settings.')
}

export function isScraperTab(tab: unknown) {
  return typeof tab === 'string' && ['scraper', 'articles', 'submissions'].includes(tab)
}

export interface ScraperSourceMode {
  version: 1
  paused: boolean
  selection: ScraperSourceSnapshot
}

export function parseScraperSourceMode(raw: string | null): ScraperSourceMode | null {
  if (!raw) return null
  try {
    const mode = JSON.parse(raw)
    if (!mode || mode.version !== 1 || typeof mode.paused !== 'boolean') return null
    const selection = parseScraperSnapshot(JSON.stringify(mode.selection))
    return selection ? { version: 1, paused: mode.paused, selection } : null
  } catch { return null }
}

export function scraperModeKey(administratorId: number) {
  return scraperSnapshotKey(administratorId).replace('.snapshot.', '.mode.')
}

export function scraperSelectionSignature(drafts: ScraperSourceDraft[]) {
  return JSON.stringify(drafts.map(({ id, indexUrl, active }) => ({ id, indexUrl, active })))
}

export function reconcileScraperSourceMode(sources: AdminScraperSource[], mode: ScraperSourceMode | null) {
  const actual = scraperSourceDrafts(sources)
  if (!mode || !sources.length) return { drafts: actual, paused: false }
  const preferred = restoreScraperSnapshot(actual, mode.selection).sources
  const allOff = sources.every(source => !source.active)
  // A saved pause or an interrupted resume can retain preferences while every
  // actual flag is off. Other database changes take precedence over local mode.
  if (allOff && (mode.paused || preferred.some(source => source.active))) return { drafts: preferred, paused: true }
  return { drafts: actual, paused: false }
}
