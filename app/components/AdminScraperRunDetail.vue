<script setup lang="ts">
import type { ScraperRunDetail } from '~~/shared/types/admin-scraper-runs'
import { scraperSourceStatuses } from '~~/shared/types/admin-scraper-runs'
import { filterScraperRunSources, scraperRunSourceUrl } from '~/utils/scraper-runs'
import AdminScraperRunSummary from './AdminScraperRunSummary.vue'

const props = defineProps<{ runId: string; now: number }>()
const route = useRoute()
const { data, status, error, refresh } = await useFetch<ScraperRunDetail>(`/api/admin/scraper/runs/${encodeURIComponent(props.runId)}`, { key: `admin-scraper-run:${props.runId}` })
const lastGood = shallowRef(data.value)
watch([data, error, status], ([value, failure, state]) => { if (value && !failure && state === 'success') lastGood.value = value })
const run = computed(() => data.value ?? lastGood.value)
const name = ref(''), sourceStatus = ref(''), title = ref('')
const expanded = ref<string[]>([])
const matches = computed(() => run.value ? filterScraperRunSources(run.value, name.value, sourceStatus.value, title.value) : [])
useScraperRunRefresh(() => refresh(), () => run.value?.status === 'running' && status.value !== 'pending' && ![400, 401, 403, 404].includes(error.value?.statusCode ?? 0))
function toggle(id: string, event: Event) {
  if ((event.target as HTMLDetailsElement).open) { if (!expanded.value.includes(id)) expanded.value.push(id) }
  else expanded.value = expanded.value.filter(value => value !== id)
}
</script>

<template>
  <div class="scraper-run-detail">
    <NuxtLink :to="{ query: { tab: 'scraper', view: 'runs', ...(route.query.runStatus === undefined ? {} : { runStatus: route.query.runStatus }), ...(route.query.runPage === undefined ? {} : { runPage: route.query.runPage }) } }">← Back to runs</NuxtLink>
    <div class="run-heading"><h3>Run #{{ runId }}</h3><button class="button button-secondary" type="button" :disabled="status === 'pending'" @click="refresh()">Refresh run</button></div>
    <p v-if="status === 'pending'" role="status">{{ run ? 'Refreshing run…' : 'Loading run…' }}</p>
    <div v-if="error" class="admin-error" role="alert">
      <p>{{ error.statusCode === 404 ? 'This scraper run no longer exists.' : error.statusCode === 400 ? 'This run ID is invalid.' : error.statusCode === 401 ? 'Your administrator session has expired. Sign in again.' : error.statusCode === 403 ? 'Administrator access is required.' : 'Run details are temporarily unavailable. Please try again.' }}{{ run ? ' Showing the last loaded results.' : '' }}</p>
      <button class="button button-secondary" type="button" :disabled="status === 'pending'" @click="refresh()">Retry run</button>
    </div>
    <template v-if="run">
      <AdminScraperRunSummary :run="run" :now="now" />
      <p v-if="run.status === 'running'">Running is the last reported status. Sources appear as their results are recorded; no current worker or completion percentage is recorded.</p>
      <p>Passed counts successful database or file saves. Totals above always cover the whole run.</p>
      <div class="run-filters">
        <label class="run-filter">Search source names<input v-model="name" type="search" maxlength="200"></label>
        <div class="run-filter"><label for="scraper-run-source-status">Source result</label><select id="scraper-run-source-status" v-model="sourceStatus"><option value="">All results</option><option v-for="value in scraperSourceStatuses" :key="value" :value="value">{{ value }}</option></select></div>
        <label class="run-filter">Search saved titles<input v-model="title" type="search" maxlength="200"></label>
      </div>
      <p v-if="!run.sources.length">No source results have been reported for this run yet.</p>
      <p v-else-if="!matches.length">No source results match these filters.</p>
      <ul v-else class="run-list">
        <li v-for="source in matches" :key="source.websiteIndexId" class="admin-card">
          <h4>{{ source.sourceName }}</h4>
          <a v-if="scraperRunSourceUrl(source.sourceUrl)" :href="scraperRunSourceUrl(source.sourceUrl)" target="_blank" rel="noopener noreferrer" class="article-url">{{ source.sourceUrl }}<span class="sr-only"> (opens in a new tab)</span></a><p v-else class="article-url">{{ source.sourceUrl }}</p>
          <p>Source #{{ source.websiteIndexId }} · <span class="run-status" :class="source.status">{{ source.status }}</span></p>
          <dl class="run-summary">
            <div><dt>Discovered</dt><dd>{{ source.discoveredCount }}</dd></div><div><dt>Processed</dt><dd>{{ source.processedCount }}</dd></div><div><dt>Passed</dt><dd>{{ source.passedCount }}</dd></div><div><dt>Invalid</dt><dd>{{ source.invalidCount }}</dd></div><div><dt>Failed articles</dt><dd>{{ source.failedCount }}</dd></div><div><dt>Skipped</dt><dd>{{ source.skippedCount }}</dd></div>
          </dl>
          <p v-if="source.error" class="run-source-error">{{ source.error }}</p>
          <details :open="expanded.includes(source.websiteIndexId) || Boolean(title.trim())" @toggle="toggle(source.websiteIndexId, $event)">
            <summary>Successfully saved titles ({{ source.titles.length }}{{ title.trim() ? ' matching' : '' }})</summary>
            <ul v-if="source.titles.length"><li v-for="(value, index) in source.titles" :key="index">{{ value }}</li></ul>
            <p v-else>No successfully saved opportunities were reported for this source.</p>
          </details>
        </li>
      </ul>
    </template>
  </div>
</template>
