<script setup lang="ts">
import type { AdminScraperSourcesResponse } from '~~/shared/types/admin-scraper'
import {
  buildScraperSourceUpdates, createScraperSnapshot, isScraperTab, parseScraperSnapshot,
  restoreScraperSnapshot, scraperSnapshotKey, scraperSourceDrafts, storeScraperSnapshot,
  type ScraperSourceSnapshot
} from '~/utils/scraper-source-state'
import AdminScraperArticles from './AdminScraperArticles.vue'

const route = useRoute()
const { user } = useUserSession()
const { $csrfFetch } = useNuxtApp()
const sourceKey = computed(() => typeof route.query.source === 'string' ? route.query.source : '')
const { data, error: loadError, status, refresh } = await useFetch<AdminScraperSourcesResponse>('/api/admin/scraper/sources', {
  key: 'admin-scraper-sources'
})
const drafts = ref(scraperSourceDrafts(data.value?.sources ?? []))
const loaded = ref(Boolean(data.value) && !loadError.value)
const saving = ref(false)
const feedback = ref('')
const error = ref('')
const backup = ref<ScraperSourceSnapshot | null>(null)
const dirty = computed(() => buildScraperSourceUpdates(drafts.value).updates.length > 0)
const busy = computed(() => saving.value || status.value === 'pending')
const sourceName = computed(() => sourceKey.value === 'unassigned'
  ? 'Unassigned articles'
  : data.value?.sources.find(source => source.id === sourceKey.value)?.name ?? 'Source articles')
const backupTime = computed(() => backup.value
  ? new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(backup.value.capturedAt)) : '')

function loadRows(result: AdminScraperSourcesResponse) {
  drafts.value = scraperSourceDrafts(result.sources)
  loaded.value = true
}
watch(data, result => { if (result && !dirty.value && !saving.value) loadRows(result) })

function storageKey() {
  return scraperSnapshotKey(user.value?.id ?? 0)
}
function readBackup() {
  backup.value = null
  try {
    const raw = window.localStorage.getItem(storageKey())
    backup.value = parseScraperSnapshot(raw)
    if (raw && !backup.value) error.value = 'Saved browser settings are invalid. Replace saved settings to create a new backup.'
  } catch { error.value = 'Saved settings could not be read from this browser. Individual changes can still be saved.' }
}
function persistBackup(replace: boolean) {
  try {
    const storage = window.localStorage
    const key = storageKey()
    const raw = storage.getItem(key)
    const previous = parseScraperSnapshot(raw)
    if (!replace && raw && !previous) throw new Error('Invalid backup')
    const snapshot = replace ? createScraperSnapshot(drafts.value) : previous ?? createScraperSnapshot(drafts.value)
    storeScraperSnapshot(storage, key, snapshot)
    backup.value = snapshot
    return true
  } catch {
    error.value = 'The backup could not be saved in this browser. No bulk changes were made. Check browser storage or use individual switches.'
    return false
  }
}
function setAll(active: boolean) {
  if (busy.value || !loaded.value || !drafts.value.length) return
  error.value = ''
  if (!persistBackup(false)) return
  drafts.value = drafts.value.map(source => ({ ...source, active }))
  feedback.value = 'Bulk changes are staged. Save changes to apply them.'
}
function replaceBackup() {
  if (busy.value || !loaded.value || !drafts.value.length) return
  error.value = ''
  if (persistBackup(true)) feedback.value = 'Current visible choices backed up in this browser. Save changes to apply unsaved source settings.'
}
function restoreBackup() {
  if (!backup.value || busy.value || !loaded.value) return
  const restored = restoreScraperSnapshot(drafts.value, backup.value)
  drafts.value = restored.sources
  error.value = ''
  feedback.value = `${restored.restored} source settings restored to the draft. ${restored.skipped} removed or changed sources skipped. Save changes to apply them.`
}
async function reloadSources() {
  if (busy.value || (dirty.value && !window.confirm('Reload sources and discard unsaved changes?'))) return
  await refresh()
  if (loadError.value || !data.value) {
    error.value = 'Sources could not be reloaded. Your unsaved choices and browser backup are still here.'
    return
  }
  loadRows(data.value)
  error.value = ''
  feedback.value = 'Sources reloaded.'
}
async function saveChanges() {
  if (busy.value || !loaded.value || !dirty.value) return
  saving.value = true
  feedback.value = ''
  error.value = ''
  try {
    const result = await $csrfFetch<AdminScraperSourcesResponse>('/api/admin/scraper/sources', {
      method: 'PATCH', body: buildScraperSourceUpdates(drafts.value)
    })
    data.value = result
    loadRows(result)
    feedback.value = 'Source settings saved.'
    await refreshNuxtData(['admin-website-indexes', 'public-website-indexes']).catch(() => {
      feedback.value += ' Reload Indexes to see the saved values.'
    })
  } catch (cause) {
    const code = cause && typeof cause === 'object' && 'statusCode' in cause ? cause.statusCode : undefined
    error.value = code === 409 ? 'A source changed or was deleted elsewhere. Reload sources before saving again. Your choices are still here.'
      : code === 401 ? 'Your administrator session has expired. Sign in again before saving.'
        : code === 403 ? 'Your security token could not be verified. Reload the page before trying again.'
          : 'Source settings could not be saved. Your choices and browser backup are still here. Try Save changes again.'
  } finally { saving.value = false }
}
function confirmLeave() {
  return !saving.value && (!dirty.value || window.confirm('Leave without saving your source settings?'))
}
function beforeUnload(event: BeforeUnloadEvent) {
  if (!dirty.value && !saving.value) return
  event.preventDefault()
  event.returnValue = ''
}
onMounted(() => {
  readBackup()
  window.addEventListener('beforeunload', beforeUnload)
})
watch(() => user.value?.id, () => { if (import.meta.client) readBackup() })
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
onBeforeRouteLeave(confirmLeave)
onBeforeRouteUpdate(to => isScraperTab(to.query.tab) || confirmLeave())
</script>

<template>
  <div>
    <div class="scraper-heading">
      <div>
        <h2 id="heading-scraper">Scraper</h2>
        <p>Browse all tracked articles, including deleted articles and those without a successful scrape.</p>
      </div>
      <div v-if="!sourceKey" class="scraper-actions">
        <button type="button" class="button button-secondary" :disabled="busy || !loaded || !drafts.length" @click="setAll(true)">Enable all</button>
        <button type="button" class="button button-secondary" :disabled="busy || !loaded || !drafts.length" @click="setAll(false)">Disable all</button>
        <button type="button" class="button button-primary" :disabled="busy || !loaded || !dirty" @click="saveChanges">{{ saving ? 'Saving…' : 'Save changes' }}</button>
      </div>
    </div>
    <p v-if="dirty" class="admin-save-state" role="status">Unsaved source settings</p>
    <p v-if="feedback" class="admin-success" role="status">{{ feedback }}</p>
    <div v-if="error" class="admin-error" role="alert">
      <p>{{ error }}</p>
      <button type="button" class="button button-secondary" :disabled="busy" @click="reloadSources">Reload sources</button>
    </div>
    <p v-if="status === 'pending'" role="status">Loading sources…</p>
    <div v-else-if="!loaded" class="admin-card" role="alert">
      <p>Sources are temporarily unavailable. Please try again.</p>
      <button type="button" class="button button-secondary" @click="reloadSources">Retry sources</button>
    </div>
    <AdminScraperArticles v-else-if="sourceKey" :key="sourceKey" :source="sourceKey" :source-name="sourceName" />
    <template v-else-if="data">
      <div class="scraper-backup">
        <p>Changes apply only after saving. Saved backups are available only in this browser for your administrator account.</p>
        <p v-if="backup">Previous settings saved {{ backupTime }}.</p>
        <div class="scraper-actions">
          <button type="button" class="button button-secondary" :disabled="busy || !backup" @click="restoreBackup">Restore previous settings</button>
          <button type="button" class="button button-secondary" :disabled="busy || !drafts.length" @click="replaceBackup">Replace saved settings</button>
        </div>
      </div>
      <p v-if="!drafts.length && !data.unassignedCount">No sources or tracked articles yet.</p>
      <ul v-else class="article-sources">
        <li v-for="source in drafts" :key="source.id" class="admin-card">
          <div class="scraper-source-heading">
            <h3><NuxtLink :to="{ query: { tab: 'scraper', source: source.id } }">{{ source.name }}</NuxtLink></h3>
            <label class="scraper-switch">
              <input v-model="source.active" type="checkbox" role="switch" :disabled="busy" :aria-label="`Enabled for scraping: ${source.name}`" @change="feedback = ''">
              <span>Enabled for scraping</span>
            </label>
          </div>
          <a :href="source.indexUrl" target="_blank" rel="noopener noreferrer" class="article-url">{{ source.indexUrl }}<span class="sr-only"> (opens in a new tab)</span></a>
          <p>{{ source.active ? 'Active' : 'Inactive' }}{{ source.active !== source.expectedActive ? ' (unsaved)' : '' }} · {{ source.articleCount }} {{ source.articleCount === 1 ? 'article' : 'articles' }}</p>
        </li>
        <li v-if="data.unassignedCount" class="admin-card">
          <h3><NuxtLink :to="{ query: { tab: 'scraper', source: 'unassigned' } }">Unassigned articles</NuxtLink></h3>
          <p>Originating source unknown · {{ data.unassignedCount }} {{ data.unassignedCount === 1 ? 'article' : 'articles' }}</p>
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.scraper-heading, .scraper-source-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
.scraper-heading h2 { margin-top: 0; }
.scraper-heading > div:first-child { flex: 1 1 280px; }
.scraper-actions { display: flex; flex-wrap: wrap; gap: 10px; }
.scraper-backup { margin-block: 20px; padding: 18px; border: 1px solid var(--line); border-radius: 8px; }
.scraper-switch { display: flex; align-items: center; gap: 10px; cursor: pointer; }
.scraper-switch input { appearance: none; flex-shrink: 0; width: 42px; height: 24px; border: 1px solid var(--ink); border-radius: 20px; background: #68736c; position: relative; cursor: pointer; }
.scraper-switch input::after { content: ''; position: absolute; width: 18px; height: 18px; top: 2px; left: 2px; border-radius: 50%; background: white; transition: transform .15s; }
.scraper-switch input:checked { background: var(--green-700); }
.scraper-switch input:checked::after { transform: translateX(18px); }
.scraper-switch input:focus-visible { outline: 3px solid var(--green-700); outline-offset: 3px; }
.scraper-switch input:disabled { opacity: .6; cursor: wait; }
.article-sources { display: grid; gap: 16px; padding: 0; list-style: none; }
.article-sources h3 { margin-bottom: 8px; }
.article-sources p { margin-bottom: 0; }
.article-url { overflow-wrap: anywhere; }
</style>
