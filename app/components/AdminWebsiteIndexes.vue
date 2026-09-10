<script setup lang="ts">
import type { AdminWebsiteIndexesResponse } from '~~/shared/types/website-index'
import {
  buildWebsiteIndexUpdateRequest,
  createWebsiteIndexDraft,
  snapshotWebsiteIndexDrafts,
  validateWebsiteIndexDrafts,
  websiteIndexesToDrafts
} from '~/utils/website-index-editor-state'

const { $csrfFetch } = useNuxtApp()
const { data, error: loadError, status, refresh } = await useFetch<AdminWebsiteIndexesResponse>('/api/admin/indexes', {
  default: () => []
})

const drafts = ref(websiteIndexesToDrafts(data.value))
const baselineDrafts = ref(websiteIndexesToDrafts(data.value))
const baseline = ref(snapshotWebsiteIndexDrafts(baselineDrafts.value))
const loaded = ref(!loadError.value)
const saving = ref(false)
const feedback = ref('')
const error = ref('')
let nextKey = 1

const dirty = computed(() => loaded.value && snapshotWebsiteIndexDrafts(drafts.value) !== baseline.value)
const loading = computed(() => status.value === 'pending')

function loadRows(rows: AdminWebsiteIndexesResponse) {
  drafts.value = websiteIndexesToDrafts(rows)
  baselineDrafts.value = websiteIndexesToDrafts(rows)
  baseline.value = snapshotWebsiteIndexDrafts(baselineDrafts.value)
  loaded.value = true
}

async function retryLoad() {
  error.value = ''
  await refresh()
  if (loadError.value) {
    loaded.value = false
    error.value = 'Website indexes could not be loaded. Try again.'
    return
  }
  loadRows(data.value)
}

function addIndex() {
  if (saving.value) return
  drafts.value.push(createWebsiteIndexDraft(`new-${nextKey++}`))
  feedback.value = ''
}

function removeIndex(index: number) {
  if (saving.value) return
  const draft = drafts.value[index]
  if (!draft) return
  if (!draft.id) drafts.value.splice(index, 1)
  else draft.deleted = true
  feedback.value = ''
}

function undoDelete(index: number) {
  if (saving.value || !drafts.value[index]) return
  drafts.value[index]!.deleted = false
}

async function saveAll() {
  if (saving.value || !dirty.value) return
  const validationError = validateWebsiteIndexDrafts(drafts.value)
  if (validationError) {
    error.value = validationError
    return
  }

  saving.value = true
  feedback.value = ''
  error.value = ''
  try {
    const result = await $csrfFetch<AdminWebsiteIndexesResponse>('/api/admin/indexes', {
      method: 'PUT',
      body: buildWebsiteIndexUpdateRequest(drafts.value, baselineDrafts.value)
    })
    loadRows(result)
    feedback.value = 'Website index changes saved.'
  } catch (cause) {
    const statusCode = cause && typeof cause === 'object' && 'statusCode' in cause ? cause.statusCode : undefined
    error.value = statusCode === 403
      ? 'Your security token could not be verified. Reload this page before trying again.'
      : statusCode === 401
        ? 'Your administrator session has expired. Sign in again before saving.'
      : statusCode === 400
        ? 'The changes could not be saved. Check every name, URL, status, and note.'
        : statusCode === 409
          ? 'Another administrator changed these records. Reload the indexes before trying again.'
          : 'The changes could not be saved. Your edits are still here.'
  } finally {
    saving.value = false
  }
}

function beforeUnload(event: BeforeUnloadEvent) {
  if (!dirty.value) return
  event.preventDefault()
  event.returnValue = ''
}

onMounted(() => window.addEventListener('beforeunload', beforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
onBeforeRouteLeave(() => !dirty.value || window.confirm('Leave without saving your website index changes?'))
</script>

<template>
  <div class="admin-indexes">
    <div class="admin-indexes-heading">
      <div>
        <h2>Website indexes</h2>
        <p class="admin-intro">Manage the source websites ECHO checks. Saved changes appear on the public Indexes page immediately.</p>
      </div>
      <div class="admin-indexes-actions">
        <button class="button admin-secondary-button" type="button" :disabled="saving || !loaded" @click="addIndex">Add website index</button>
        <button class="button button-primary" type="button" :disabled="saving || !dirty" @click="saveAll">
          {{ saving ? 'Saving…' : 'Save all changes' }}
        </button>
      </div>
    </div>

    <p v-if="dirty" class="admin-save-state">Unsaved changes</p>
    <p v-if="feedback" class="admin-success" role="status">{{ feedback }}</p>
    <p v-if="error" class="admin-error" role="alert">{{ error }}</p>

    <div v-if="!loaded" class="admin-card admin-editor-load-error">
      <h3>Website indexes could not be loaded</h3>
      <p>Check the database connection and try again.</p>
      <button class="button button-primary" type="button" :disabled="loading" @click="retryLoad">
        {{ loading ? 'Loading…' : 'Try again' }}
      </button>
    </div>

    <div v-else-if="drafts.length" class="admin-index-list">
      <article v-for="(draft, index) in drafts" :key="draft.key" class="admin-card admin-index-card" :class="{ 'is-deleted': draft.deleted }">
        <div class="admin-index-card-heading">
          <h3>{{ draft.deleted ? `${draft.name || 'Website index'} will be deleted` : draft.name || 'New website index' }}</h3>
          <button v-if="draft.deleted" class="button admin-secondary-button" type="button" :disabled="saving" @click="undoDelete(index)">Undo deletion</button>
          <button v-else class="button admin-danger-button" type="button" :disabled="saving" @click="removeIndex(index)">Delete</button>
        </div>

        <fieldset class="admin-index-fields" :disabled="saving || draft.deleted">
          <legend class="sr-only">{{ draft.name || 'New website index' }} details</legend>
          <label :for="`${draft.key}-name`">Name</label>
          <input :id="`${draft.key}-name`" v-model="draft.name" type="text" maxlength="255" required>

          <label :for="`${draft.key}-url`">Index URL</label>
          <input :id="`${draft.key}-url`" v-model="draft.indexUrl" type="url" inputmode="url" placeholder="https://example.gov.au/consultations" required>

          <label class="admin-index-active" :for="`${draft.key}-active`">
            <input :id="`${draft.key}-active`" v-model="draft.active" type="checkbox">
            Active
          </label>

          <label :for="`${draft.key}-notes`">Internal notes</label>
          <textarea :id="`${draft.key}-notes`" v-model="draft.notes" rows="4" placeholder="Optional notes for administrators" />
        </fieldset>
      </article>
    </div>

    <div v-else class="admin-card admin-index-empty">
      <h3>No website indexes</h3>
      <p>Add a website index, then save all changes.</p>
    </div>
  </div>
</template>
