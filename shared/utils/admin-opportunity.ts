import { jurisdictions, opportunityCategories } from '../types/opportunity'
import type { CreateOpportunityRequest, OpportunityOrganisationSelection } from '../types/admin-opportunity'
import { parseOpportunityDeadline } from './opportunity-deadline'

export class OpportunityValidationError extends Error {
  constructor(public field: string, message: string) { super(message) }
}
const fail = (field: string, message: string): never => { throw new OpportunityValidationError(field, message) }
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
function onlyKeys(value: Record<string, unknown>, keys: string[], field: string) {
  if (Object.keys(value).some(key => !keys.includes(key))) fail(field, 'Unsupported fields were supplied.')
}
function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) return fail(field, 'Enter a non-empty value.')
  const trimmed = value.trim()
  if (/<\/?[a-z][^>]*>/i.test(trimmed)) return fail(field, 'Use plain text rather than HTML.')
  return trimmed
}
export function normalizeOpportunityLabels(value: unknown, field: string, canonicalInvite = false): string[] {
  if (!Array.isArray(value)) return fail(field, 'Supply a list of labels.')
  const seen = new Set<string>()
  return value.map((item, index) => {
    const label = text(item, `${field}.${index}`)
    return canonicalInvite && label.toLowerCase() === 'invite-only' ? 'Invite-only' : label
  }).filter(label => {
    const key = label.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
function timestamp(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.includes('T') || !value.endsWith('Z')) return fail(field, 'Enter an exact date and time in UTC.')
  try { return parseOpportunityDeadline(value).toISOString() } catch { return fail(field, 'Enter a valid UTC date and time (years 0001–9999).') }
}
function organisation(value: unknown): OpportunityOrganisationSelection {
  if (!record(value)) return fail('organisation', 'Select an organisation or enter a new name and index URL.')
  if ('existingId' in value) {
    onlyKeys(value, ['existingId'], 'organisation')
    const id = value.existingId
    if (typeof id !== 'string' || !/^[1-9]\d*$/.test(id) || BigInt(id) > 9223372036854775807n) {
      return fail('organisation', 'Select a valid organisation.')
    }
    return { existingId: id }
  }
  onlyKeys(value, ['newSource'], 'organisation')
  if (!record(value.newSource)) return fail('organisation', 'Enter the organisation name and index URL.')
  onlyKeys(value.newSource, ['name', 'indexUrl'], 'organisation.newSource')
  const name = text(value.newSource.name, 'organisation.newSource.name')
  if (name.length > 255) return fail('organisation.newSource.name', 'Keep the organisation name to 255 characters or fewer.')
  const indexUrl = text(value.newSource.indexUrl, 'organisation.newSource.indexUrl')
  try {
    if (new URL(indexUrl).protocol !== 'https:') throw new Error()
  } catch { return fail('organisation.newSource.indexUrl', 'Enter a valid absolute HTTPS index URL.') }
  return { newSource: { name, indexUrl } }
}

// Shared by the preview and server; the server always validates its own input.
export function validateCreateOpportunity(value: unknown): CreateOpportunityRequest {
  if (!record(value)) return fail('form', 'Supply an opportunity.')
  onlyKeys(value, ['title', 'summary', 'fullText', 'sourceUrl', 'organisation', 'jurisdiction', 'startDate', 'submissionDeadline', 'category', 'tags', 'location'], 'form')
  const title = text(value.title, 'title')
  if (!Array.isArray(value.fullText) || !value.fullText.length) return fail('fullText', 'Add at least one paragraph.')
  const fullText = value.fullText.map((item, index) => text(item, `fullText.${index}`))
  let sourceUrl: string
  try {
    const url = new URL(text(value.sourceUrl, 'sourceUrl'))
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) throw new Error()
    url.hash = ''
    sourceUrl = url.toString()
  } catch { return fail('sourceUrl', 'Enter an absolute HTTPS consultation URL without credentials.') }
  const selectedOrganisation = organisation(value.organisation)
  if (!jurisdictions.includes(value.jurisdiction as never)) return fail('jurisdiction', 'Select a supported jurisdiction.')
  const category = normalizeOpportunityLabels(value.category, 'category')
  if (!category.length || category.some(item => !opportunityCategories.includes(item as never))) return fail('category', 'Select at least one supported category.')
  const tags = value.tags == null ? [] : normalizeOpportunityLabels(value.tags, 'tags', true)
  let submissionDeadline: string
  try {
    if (typeof value.submissionDeadline !== 'string') throw new Error()
    parseOpportunityDeadline(value.submissionDeadline)
    submissionDeadline = value.submissionDeadline
  } catch { return fail('submissionDeadline', 'Enter a valid YYYY-MM month or exact UTC date and time (years 0001–9999).') }
  const startDate = value.startDate == null || value.startDate === '' ? null : timestamp(value.startDate, 'startDate')
  if (startDate && Date.parse(startDate) > parseOpportunityDeadline(submissionDeadline).getTime()) return fail('startDate', 'Opening must not be later than the deadline. Month-only deadlines close at the start of the month.')
  const summary = value.summary == null || (typeof value.summary === 'string' && !value.summary.trim()) ? undefined : text(value.summary, 'summary')
  if (summary && summary.split(/\s+/).length > 35) return fail('summary', 'Keep the summary to 35 words or fewer.')
  let location: CreateOpportunityRequest['location']
  if (value.location != null) {
    const point = value.location
    if (!record(point)) return fail('location', 'Supply a location label and map point.')
    onlyKeys(point, ['label', 'geometry'], 'location')
    const label = text(point.label, 'location.label')
    if (!record(point.geometry)) return fail('location', 'Supply a Point geometry.')
    onlyKeys(point.geometry, ['type', 'coordinates'], 'location')
    const coordinates = point.geometry.coordinates
    if (point.geometry.type !== 'Point' || !Array.isArray(coordinates) || coordinates.length !== 2
      || coordinates.some(item => typeof item !== 'number' || !Number.isFinite(item))
      || coordinates[0] < -180 || coordinates[0] > 180 || coordinates[1] < -90 || coordinates[1] > 90) {
      return fail('location', 'Enter longitude between −180 and 180 and latitude between −90 and 90.')
    }
    location = { label, geometry: { type: 'Point', coordinates: [coordinates[0], coordinates[1]] } }
  }
  return { title, fullText, sourceUrl, organisation: selectedOrganisation, jurisdiction: value.jurisdiction as CreateOpportunityRequest['jurisdiction'],
    startDate, submissionDeadline, category: category as CreateOpportunityRequest['category'], tags: tags.length ? tags : null,
    ...(summary ? { summary } : {}), ...(location ? { location } : {}) }
}
