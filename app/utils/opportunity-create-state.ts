import type { Jurisdiction, OpportunityCategory, OpportunityResponse } from '~~/shared/types/opportunity'
import { OpportunityValidationError, validateCreateOpportunity } from '~~/shared/utils/admin-opportunity'
import { melbourneDateTimeToUtc, melbourneInputsFromUtc } from '~~/shared/utils/melbourne-time'

export interface OpportunityCreateDraft {
  title: string; sourceUrl: string; sourceOrg: string; jurisdiction: Jurisdiction | ''
  paragraphs: { key: number; text: string }[]; summary: string
  sourceIndexId: string; newSourceIndexUrl: string
  startDate: string; startTime: string; startOccurrence: string
  deadlineMode: 'datetime' | 'month'; deadlineDate: string; deadlineTime: string; deadlineOccurrence: string; deadlineMonth: string
  categories: OpportunityCategory[]; tags: string[]; inviteOnly: boolean
  locationEnabled: boolean; locationLabel: string; latitude: string | number; longitude: string | number
}
export function newOpportunityDraft(): OpportunityCreateDraft {
  return { title: '', sourceUrl: '', sourceOrg: '', jurisdiction: '', paragraphs: [{ key: 1, text: '' }], summary: '',
    sourceIndexId: '', newSourceIndexUrl: '', startDate: '', startTime: '', startOccurrence: '',
    deadlineMode: 'datetime', deadlineDate: '', deadlineTime: '', deadlineOccurrence: '', deadlineMonth: '', categories: [], tags: [], inviteOnly: false,
    locationEnabled: false, locationLabel: '', latitude: '', longitude: '' }
}
function localTime(date: string, time: string, occurrence: string, field: string) {
  try { return melbourneDateTimeToUtc(date, time, occurrence) } catch (cause) {
    throw new OpportunityValidationError(field, cause instanceof Error ? cause.message : 'Enter a valid Melbourne date and time.')
  }
}
export function buildCreateOpportunity(draft: OpportunityCreateDraft) {
  if (!draft.startDate && draft.startTime) throw new OpportunityValidationError('startDate', 'Enter an opening date with this time, or clear the time.')
  let location
  if (draft.locationEnabled) {
    if (!String(draft.latitude).trim() || !String(draft.longitude).trim()) throw new OpportunityValidationError('location', 'Enter both latitude and longitude.')
    location = { label: draft.locationLabel, geometry: { type: 'Point', coordinates: [Number(draft.longitude), Number(draft.latitude)] } }
  }
  return validateCreateOpportunity({
    title: draft.title, sourceUrl: draft.sourceUrl, jurisdiction: draft.jurisdiction,
    fullText: draft.paragraphs.map(paragraph => paragraph.text), summary: draft.summary,
    organisation: draft.sourceIndexId ? { existingId: draft.sourceIndexId } : { newSource: { name: draft.sourceOrg, indexUrl: draft.newSourceIndexUrl } },
    startDate: draft.startDate ? localTime(draft.startDate, draft.startTime, draft.startOccurrence, 'startDate') : null,
    submissionDeadline: draft.deadlineMode === 'month' ? draft.deadlineMonth : localTime(draft.deadlineDate, draft.deadlineTime, draft.deadlineOccurrence, 'submissionDeadline'),
    category: draft.categories,
    tags: [...draft.tags.filter(tag => tag.trim().toLowerCase() !== 'invite-only'), ...(draft.inviteOnly ? ['Invite-only'] : [])],
    ...(location ? { location } : {})
  })
}

// Preserve the stored instant and precision and leave existing boundaries intact until explicitly replaced.
export function draftFromOpportunity(opportunity: OpportunityResponse): OpportunityCreateDraft {
  const point = opportunity.location?.geometry.type === 'Point' ? opportunity.location : undefined
  const coordinates = point?.geometry.type === 'Point' ? point.geometry.coordinates : undefined
  const month = /^\d{4}-\d{2}$/.test(opportunity.submissionDeadline)
  const start = opportunity.startDate ? melbourneInputsFromUtc(opportunity.startDate) : null
  const deadline = month ? null : melbourneInputsFromUtc(opportunity.submissionDeadline)
  return { ...newOpportunityDraft(), title: opportunity.title, sourceUrl: opportunity.sourceUrl,
    sourceOrg: opportunity.sourceOrg, sourceIndexId: opportunity.website, jurisdiction: opportunity.jurisdiction,
    paragraphs: opportunity.fullText.map((text, index) => ({ key: index + 1, text })), summary: opportunity.summary ?? '',
    categories: [...opportunity.category], tags: [...(opportunity.tags ?? []).filter(tag => tag.toLowerCase() !== 'invite-only')],
    inviteOnly: (opportunity.tags ?? []).some(tag => tag.toLowerCase() === 'invite-only'),
    startDate: start?.date ?? '', startTime: start?.time ?? '', startOccurrence: start?.occurrence ?? '', deadlineMode: month ? 'month' : 'datetime',
    deadlineMonth: month ? opportunity.submissionDeadline : '', deadlineDate: deadline?.date ?? '', deadlineTime: deadline?.time ?? '', deadlineOccurrence: deadline?.occurrence ?? '',
    locationEnabled: Boolean(point), locationLabel: point?.label ?? '', longitude: coordinates?.[0] ?? '', latitude: coordinates?.[1] ?? '' }
}
