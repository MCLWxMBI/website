import type { Jurisdiction, OpportunityCategory, OpportunityResponse } from '~~/shared/types/opportunity'
import { OpportunityValidationError, validateCreateOpportunity } from '~~/shared/utils/admin-opportunity'
import { parseOpportunityDeadline } from '~~/shared/utils/opportunity-deadline'

export interface OpportunityCreateDraft {
  title: string; sourceUrl: string; sourceOrg: string; jurisdiction: Jurisdiction | ''
  paragraphs: { key: number; text: string }[]; summary: string
  sourceIndexId: string; newSourceIndexUrl: string
  startDate: string; deadlineMode: 'datetime' | 'month'; deadlineDateTime: string; deadlineMonth: string
  categories: OpportunityCategory[]; tags: string[]; inviteOnly: boolean
  locationEnabled: boolean; locationLabel: string; latitude: string | number; longitude: string | number
}
export function newOpportunityDraft(): OpportunityCreateDraft {
  return { title: '', sourceUrl: '', sourceOrg: '', jurisdiction: '', paragraphs: [{ key: 1, text: '' }], summary: '',
    sourceIndexId: '', newSourceIndexUrl: '', startDate: '',
    deadlineMode: 'datetime', deadlineDateTime: '', deadlineMonth: '', categories: [], tags: [], inviteOnly: false,
    locationEnabled: false, locationLabel: '', latitude: '', longitude: '' }
}
function utc(value: string, field: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/.test(value)) throw new OpportunityValidationError(field, 'Enter an exact date and time in UTC.')
  const timestamp = `${value.length === 16 ? value + ':00' : value}Z`
  try { return parseOpportunityDeadline(timestamp).toISOString() } catch { throw new OpportunityValidationError(field, 'Enter a valid UTC date and time.') }
}
export function buildCreateOpportunity(draft: OpportunityCreateDraft) {
  let location
  if (draft.locationEnabled) {
    if (!String(draft.latitude).trim() || !String(draft.longitude).trim()) throw new OpportunityValidationError('location', 'Enter both latitude and longitude.')
    location = { label: draft.locationLabel, geometry: { type: 'Point', coordinates: [Number(draft.longitude), Number(draft.latitude)] } }
  }
  return validateCreateOpportunity({
    title: draft.title, sourceUrl: draft.sourceUrl, jurisdiction: draft.jurisdiction,
    fullText: draft.paragraphs.map(paragraph => paragraph.text), summary: draft.summary,
    organisation: draft.sourceIndexId ? { existingId: draft.sourceIndexId } : { newSource: { name: draft.sourceOrg, indexUrl: draft.newSourceIndexUrl } },
    startDate: draft.startDate ? utc(draft.startDate, 'startDate') : null,
    submissionDeadline: draft.deadlineMode === 'month' ? draft.deadlineMonth : utc(draft.deadlineDateTime, 'submissionDeadline'),
    category: draft.categories,
    tags: [...draft.tags.filter(tag => tag.trim().toLowerCase() !== 'invite-only'), ...(draft.inviteOnly ? ['Invite-only'] : [])],
    ...(location ? { location } : {})
  })
}

// Preserve UTC precision and leave existing boundaries intact until explicitly replaced.
export function draftFromOpportunity(opportunity: OpportunityResponse): OpportunityCreateDraft {
  const point = opportunity.location?.geometry.type === 'Point' ? opportunity.location : undefined
  const coordinates = point?.geometry.type === 'Point' ? point.geometry.coordinates : undefined
  const month = /^\d{4}-\d{2}$/.test(opportunity.submissionDeadline)
  return { ...newOpportunityDraft(), title: opportunity.title, sourceUrl: opportunity.sourceUrl,
    sourceOrg: opportunity.sourceOrg, sourceIndexId: opportunity.website, jurisdiction: opportunity.jurisdiction,
    paragraphs: opportunity.fullText.map((text, index) => ({ key: index + 1, text })), summary: opportunity.summary ?? '',
    categories: [...opportunity.category], tags: [...(opportunity.tags ?? []).filter(tag => tag.toLowerCase() !== 'invite-only')],
    inviteOnly: (opportunity.tags ?? []).some(tag => tag.toLowerCase() === 'invite-only'),
    startDate: opportunity.startDate?.slice(0, -1) ?? '', deadlineMode: month ? 'month' : 'datetime',
    deadlineMonth: month ? opportunity.submissionDeadline : '', deadlineDateTime: month ? '' : opportunity.submissionDeadline.slice(0, -1),
    locationEnabled: Boolean(point), locationLabel: point?.label ?? '', longitude: coordinates?.[0] ?? '', latitude: coordinates?.[1] ?? '' }
}
