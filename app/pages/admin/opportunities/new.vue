<script setup lang="ts">
import type { AdminOpportunityOptionsResponse, CreateOpportunityRequest } from '~~/shared/types/admin-opportunity'
import type { OpportunityDetailResponse } from '~~/shared/types/opportunity'
import { jurisdictions, opportunityCategories } from '~~/shared/types/opportunity'
import { OpportunityValidationError } from '~~/shared/utils/admin-opportunity'
import { buildCreateOpportunity, newOpportunityDraft } from '~/utils/opportunity-create-state'
import AdminOrganisationInput from '~/components/AdminOrganisationInput.vue'
import AdminTagInput from '~/components/AdminTagInput.vue'
import AdminOpportunityPreview from '~/components/AdminOpportunityPreview.vue'

definePageMeta({ layout: 'admin', middleware: 'admin' })
useSeoMeta({ title: 'Create opportunity' })
const { $csrfFetch } = useNuxtApp()
const { data: options, error: optionsError, status: optionsStatus, refresh: refreshOptions } = await useFetch<AdminOpportunityOptionsResponse>('/api/admin/opportunities/options')
const { currentTime } = await useServerTime()
const draft = ref(newOpportunityDraft())
const initial = ref(JSON.stringify(draft.value))
const preview = ref<CreateOpportunityRequest | null>(null)
const saving = ref(false)
const created = ref<OpportunityDetailResponse | null>(null)
const error = ref('')
const fieldErrors = ref<Record<string, string>>({})
const existingOpportunityId = ref('')
const dirty = computed(() => !created.value && JSON.stringify(draft.value) !== initial.value)
const summaryWords = computed(() => draft.value.summary.trim() ? draft.value.summary.trim().split(/\s+/).length : 0)
const selectedSource = computed(() => options.value?.sources.find(source => source.id === draft.value.sourceIndexId))
const previewSource = computed(() => {
  const selection = preview.value?.organisation
  return selection && 'existingId' in selection ? options.value?.sources.find(source => source.id === selection.existingId) : undefined
})
const websiteFeatures = computed(() => previewSource.value?.websiteTags ?? [])
const organisationName = computed(() => {
  const selection = preview.value?.organisation
  return selection && 'newSource' in selection ? selection.newSource.name : previewSource.value?.name ?? draft.value.sourceOrg
})
let nextParagraph = 2
const invalid = (field: string) => Object.keys(fieldErrors.value).some(key => key === field || key.startsWith(`${field}.`)) || undefined
function fieldLabel(field: string) {
  if (field.startsWith('fullText.')) return 'Paragraph ' + (Number(field.split('.')[1]) + 1)
  if (field === 'organisation.newSource.indexUrl') return 'Organisation index URL'
  return ({ title: 'Title', sourceUrl: 'Official consultation URL', organisation: 'Publishing organisation', jurisdiction: 'Jurisdiction',
    summary: 'Summary', fullText: 'Paragraphs', category: 'Categories', tags: 'Other tags',
    startDate: 'Opening date and time', submissionDeadline: 'Deadline', location: 'Location', form: 'Listing' } as Record<string, string>)[field.split('.')[0]!] ?? 'Listing'
}
function moveParagraph(index: number, direction: number) {
  const target = index + direction
  if (target < 0 || target >= draft.value.paragraphs.length) return
  const [paragraph] = draft.value.paragraphs.splice(index, 1)
  draft.value.paragraphs.splice(target, 0, paragraph!)
}
function showPreview() {
  error.value = ''
  fieldErrors.value = {}
  existingOpportunityId.value = ''
  try { preview.value = buildCreateOpportunity(draft.value) } catch (cause) {
    if (cause instanceof OpportunityValidationError) fieldErrors.value = { [cause.field]: cause.message }
    else error.value = 'Check the form and try again.'
  }
}
async function publish() {
  if (!preview.value || saving.value || created.value) return
  saving.value = true
  error.value = ''
  fieldErrors.value = {}
  existingOpportunityId.value = ''
  try {
    created.value = await $csrfFetch<OpportunityDetailResponse>('/api/admin/opportunities', { method: 'POST', body: preview.value })
  } catch (cause) {
    const failure = cause as { statusCode?: number; data?: { statusMessage?: string; data?: { fieldErrors?: Record<string, string>; opportunityId?: string } } }
    if (failure.statusCode === 400 && failure.data?.data?.fieldErrors) fieldErrors.value = failure.data.data.fieldErrors
    error.value = failure.statusCode === 409 ? failure.data?.statusMessage ?? 'This listing or source has changed. Reload the organisation suggestions.'
      : failure.statusCode === 401 ? 'Your administrator session expired. Sign in again before publishing.'
        : failure.statusCode === 403 ? 'Your security token could not be verified. Reload the page before trying again.'
          : failure.statusCode === 400 ? 'Check the opportunity fields before publishing.'
            : 'The opportunity could not be published. Your entries are still here. Please try again.'
    existingOpportunityId.value = failure.data?.data?.opportunityId ?? ''
  } finally { saving.value = false }
  if (created.value) await navigateTo(`/opportunities/${encodeURIComponent(created.value.opportunity.id)}`)
}
function confirmLeave() {
  return !saving.value && (!dirty.value || window.confirm('Leave without publishing this opportunity? Your unsaved entries will be lost.'))
}
function beforeUnload(event: BeforeUnloadEvent) {
  if (!dirty.value && !saving.value) return
  event.preventDefault(); event.returnValue = ''
}
onMounted(() => window.addEventListener('beforeunload', beforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
onBeforeRouteLeave(confirmLeave)
</script>

<template>
  <section class="create-opportunity" aria-labelledby="create-title" :aria-busy="saving">
    <NuxtLink :to="{ path: '/admin', query: { tab: 'opportunities' } }">← Back to Opportunities</NuxtLink>
    <h1 id="create-title">Create opportunity</h1>
    <p>Complete the listing, review its preview, then publish it to the catalogue.</p>
    <div v-if="error || Object.keys(fieldErrors).length" class="admin-error" role="alert">
      <p v-if="error">{{ error }}</p>
      <ul v-if="Object.keys(fieldErrors).length"><li v-for="(message, field) in fieldErrors" :key="field"><strong>{{ fieldLabel(String(field)) }}:</strong> {{ message }}</li></ul>
      <NuxtLink v-if="existingOpportunityId" :to="`/opportunities/${encodeURIComponent(existingOpportunityId)}`">View existing opportunity</NuxtLink>
    </div>
    <div v-if="optionsError" class="admin-card" role="alert">
      <p>Organisation suggestions are temporarily unavailable. Your entries are still here.</p>
      <button class="button button-secondary" type="button" :disabled="optionsStatus === 'pending' || saving" @click="refreshOptions()">Retry organisation suggestions</button>
    </div>
    <div v-if="preview" class="opportunity-review">
      <AdminOpportunityPreview :request="preview" :organisation-name="organisationName" :website-tags="websiteFeatures" :current-time="currentTime" />
      <div class="create-actions">
        <button type="button" class="button button-secondary" :disabled="saving || Boolean(created)" @click="preview = null">Edit listing</button>
        <button type="button" class="button button-primary" :disabled="saving || Boolean(created)" @click="publish">{{ saving ? 'Publishing…' : 'Publish opportunity' }}</button>
      </div>
    </div>
    <form v-else-if="options" class="admin-card opportunity-form" novalidate @submit.prevent="showPreview">
      <fieldset :disabled="saving">
        <legend>Listing details</legend>
        <label for="opportunity-title">Title <span>(required)</span></label>
        <input id="opportunity-title" v-model="draft.title" type="text" required :aria-invalid="invalid('title')">
        <label for="opportunity-url">Official consultation URL <span>(required, HTTPS)</span></label>
        <input id="opportunity-url" v-model="draft.sourceUrl" type="url" required :aria-invalid="invalid('sourceUrl')">
        <AdminOrganisationInput v-model="draft.sourceOrg" v-model:source-id="draft.sourceIndexId" :sources="options.sources" :invalid="invalid('organisation')" />
        <p v-if="selectedSource">Linked source: {{ selectedSource.indexUrl }}<span v-if="!selectedSource.active"> · Scraping disabled</span></p>
        <template v-if="!draft.sourceIndexId">
          <label for="organisation-index-url">Organisation index URL <span>(required for a new organisation, HTTPS)</span></label>
          <input id="organisation-index-url" v-model="draft.newSourceIndexUrl" type="url" required :aria-invalid="invalid('organisation.newSource.indexUrl')">
          <p>Publishing will also create this source with scraping disabled. You can enable it later in Scraper or Indexes.</p>
        </template>
        <button type="button" class="button button-secondary" :disabled="optionsStatus === 'pending'" @click="refreshOptions()">Reload organisation suggestions</button>
        <label for="opportunity-jurisdiction">Jurisdiction <span>(required)</span></label>
        <select id="opportunity-jurisdiction" v-model="draft.jurisdiction" required :aria-invalid="invalid('jurisdiction')"><option value="" disabled>Select jurisdiction</option><option v-for="jurisdiction in jurisdictions" :key="jurisdiction">{{ jurisdiction }}</option></select>
        <label for="opportunity-summary">Summary <span>(optional, up to 35 words)</span></label>
        <textarea id="opportunity-summary" v-model="draft.summary" rows="3" :aria-invalid="invalid('summary')" />
        <p>{{ summaryWords }}/35 words. If blank, the listing uses the start of the first paragraph.</p>
        <div v-for="(paragraph, index) in draft.paragraphs" :key="paragraph.key" class="paragraph-editor">
          <label :for="`paragraph-${paragraph.key}`">Paragraph {{ index + 1 }} <span>(plain text, required)</span></label>
          <textarea :id="`paragraph-${paragraph.key}`" v-model="paragraph.text" rows="5" required :aria-invalid="invalid(`fullText.${index}`)" />
          <div class="create-actions">
            <button type="button" class="button button-secondary" :disabled="index === 0" :aria-label="`Move paragraph ${index + 1} up`" @click="moveParagraph(index, -1)">Move up</button>
            <button type="button" class="button button-secondary" :disabled="index === draft.paragraphs.length - 1" :aria-label="`Move paragraph ${index + 1} down`" @click="moveParagraph(index, 1)">Move down</button>
            <button type="button" class="button button-secondary" :disabled="draft.paragraphs.length === 1" :aria-label="`Remove paragraph ${index + 1}`" @click="draft.paragraphs.splice(index, 1)">Remove</button>
          </div>
        </div>
        <button type="button" class="button button-secondary" @click="draft.paragraphs.push({ key: nextParagraph++, text: '' })">Add paragraph</button>
      </fieldset>
      <fieldset :disabled="saving" :aria-invalid="invalid('category')">
        <legend>Categories <span>(select at least one)</span></legend>
        <label v-for="category in opportunityCategories" :key="category" class="choice"><input v-model="draft.categories" type="checkbox" :value="category"> {{ category }}</label>
      </fieldset>
      <fieldset :disabled="saving">
        <legend>Opportunity tags</legend>
        <label class="choice"><input v-model="draft.inviteOnly" type="checkbox"> Invite-only</label>
        <AdminTagInput v-model="draft.tags" label="Other tags" invite-toggle :disabled="saving" @invite-only="draft.inviteOnly = true" />
      </fieldset>
      <fieldset :disabled="saving">
        <legend>Dates</legend>
        <p>Exact dates and times are entered in UTC. Status is calculated from the opening and closing dates.</p>
        <label for="opportunity-start">Opening date and time (UTC, optional)</label>
        <input id="opportunity-start" v-model="draft.startDate" type="datetime-local" step="1" :aria-invalid="invalid('startDate')">
        <label class="choice"><input v-model="draft.deadlineMode" type="radio" value="datetime"> Exact deadline</label>
        <label class="choice"><input v-model="draft.deadlineMode" type="radio" value="month"> Month-only deadline</label>
        <template v-if="draft.deadlineMode === 'datetime'">
          <label for="opportunity-deadline">Closing date and time (UTC, required)</label>
          <input id="opportunity-deadline" v-model="draft.deadlineDateTime" type="datetime-local" step="1" :aria-invalid="invalid('submissionDeadline')">
        </template>
        <template v-else>
          <label for="opportunity-month">Closing month and year (required)</label>
          <input id="opportunity-month" v-model="draft.deadlineMonth" type="month" :aria-invalid="invalid('submissionDeadline')">
          <p>A month-only deadline closes at midnight UTC on the first day of that month.</p>
        </template>
      </fieldset>
      <fieldset :disabled="saving">
        <legend>Location (optional)</legend>
        <label class="choice"><input v-model="draft.locationEnabled" type="checkbox"> Include a map pin</label>
        <template v-if="draft.locationEnabled">
          <label for="opportunity-place">Place label</label><input id="opportunity-place" v-model="draft.locationLabel" type="text" :aria-invalid="invalid('location')">
          <div class="coordinate-fields">
            <div><label for="opportunity-latitude">Latitude (−90 to 90)</label><input id="opportunity-latitude" v-model="draft.latitude" type="number" min="-90" max="90" step="any" :aria-invalid="invalid('location')"></div>
            <div><label for="opportunity-longitude">Longitude (−180 to 180)</label><input id="opportunity-longitude" v-model="draft.longitude" type="number" min="-180" max="180" step="any" :aria-invalid="invalid('location')"></div>
          </div>
        </template>
      </fieldset>
      <button type="submit" class="button button-primary" :disabled="saving || Boolean(optionsError)">Preview opportunity</button>
    </form>
  </section>
</template>

<style scoped>
.create-opportunity { max-width: 1000px; margin-inline: auto; }
.opportunity-form fieldset { border: 0; border-bottom: 1px solid var(--line); margin: 0 0 28px; padding: 0 0 24px; min-width: 0; }
.opportunity-form legend { font-size: 1.25rem; font-weight: 700; margin-bottom: 12px; }
.opportunity-form label:not(.choice) { display: block; font-weight: 700; margin: 16px 0 8px; }
.opportunity-form label span, legend span { font-weight: 400; }
.opportunity-form input:not([type=checkbox]):not([type=radio]), .opportunity-form textarea, .opportunity-form select { width: 100%; min-width: 0; padding: 12px; border: 1px solid var(--line); border-radius: 6px; font: inherit; }
.opportunity-form textarea { resize: vertical; }
.opportunity-form [aria-invalid=true] { border-color: #a32727 !important; }
.choice { display: flex; gap: 10px; align-items: center; margin-block: 12px; }
.choice input { flex-shrink: 0; }
.create-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-block: 18px; }
.coordinate-fields { display: flex; flex-wrap: wrap; gap: 20px; }
.coordinate-fields > div { flex: 1 1 220px; min-width: 0; }
.paragraph-editor { margin-bottom: 20px; }
</style>
