import type { ScraperRunSummary, ScraperRunDetail } from '../../shared/types/admin-scraper-runs'

export function formatScraperRunTime(value: string | null): string {
  if (!value) return 'Not recorded'
  return new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Melbourne', dateStyle: 'medium', timeStyle: 'long' }).format(new Date(value))
}

export function scraperRunDuration(run: Pick<ScraperRunSummary, 'startedAt' | 'finishedAt' | 'status'>, now: number): string {
  if (!run.finishedAt && run.status !== 'running') return 'Not recorded'
  const seconds = Math.max(0, Math.floor(((run.finishedAt ? Date.parse(run.finishedAt) : now) - Date.parse(run.startedAt)) / 1000))
  const hours = Math.floor(seconds / 3600), minutes = Math.floor(seconds % 3600 / 60)
  return `${hours ? `${hours}h ` : ''}${minutes}m ${seconds % 60}s${run.finishedAt ? '' : ' since start'}`
}

export function scraperRunSourceUrl(value: string): string | undefined {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined
  } catch { return undefined }
}

export function filterScraperRunSources(run: ScraperRunDetail, name: string, status: string, title: string) {
  const nameQuery = name.trim().toLocaleLowerCase(), titleQuery = title.trim().toLocaleLowerCase()
  return run.sources.map(source => {
    const titles = run.extractedOpportunities.find(group => group.websiteIndexId === source.websiteIndexId)?.titles ?? []
    return { ...source, titles: titleQuery ? titles.filter(value => value.toLocaleLowerCase().includes(titleQuery)) : titles }
  }).filter(source => (!nameQuery || source.sourceName.toLocaleLowerCase().includes(nameQuery))
    && (!status || source.status === status) && (!titleQuery || source.titles.length > 0))
}
