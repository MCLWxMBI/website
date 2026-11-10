<script setup lang="ts">
import type { ScraperRunsResponse } from '~~/shared/types/admin-scraper-runs'
import { scraperRunStatuses } from '~~/shared/types/admin-scraper-runs'
import AdminScraperRunDetail from './AdminScraperRunDetail.vue'
import AdminScraperRunSummary from './AdminScraperRunSummary.vue'

const route = useRoute()
const runId = computed(() => route.query.run === undefined ? '' : typeof route.query.run === 'string' ? route.query.run : 'invalid')
const { currentTime } = await useServerTime()
const query = computed(() => ({ ...(route.query.runStatus === undefined ? {} : { status: route.query.runStatus }), page: route.query.runPage ?? '1' }))
const { data, status, error, refresh } = await useFetch<ScraperRunsResponse>('/api/admin/scraper/runs', {
  key: 'admin-scraper-runs', query
})
const lastGood = shallowRef(data.value)
watch(query, () => { lastGood.value = null })
watch([data, error, status], ([value, failure, state]) => { if (value && !failure && state === 'success') lastGood.value = value })
const runs = computed(() => data.value ?? lastGood.value)
const pages = computed(() => Math.max(1, Math.ceil((runs.value?.total ?? 0) / (runs.value?.pageSize ?? 25))))
useScraperRunRefresh(() => refresh(), () => !runId.value && status.value !== 'pending' && ![400, 401, 403].includes(error.value?.statusCode ?? 0))

function pageLink(page: number) {
  return { query: { tab: 'scraper', view: 'runs', ...(route.query.runStatus === undefined ? {} : { runStatus: route.query.runStatus }), runPage: String(page) } }
}
async function selectStatus(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  await navigateTo({ query: { tab: 'scraper', view: 'runs', ...(value ? { runStatus: value } : {}) } })
}
</script>

<template>
  <AdminScraperRunDetail v-if="runId" :key="runId" :run-id="runId" :now="currentTime" />
  <div v-else class="scraper-runs">
    <div class="run-heading"><h3>Run history</h3><button class="button button-secondary" type="button" :disabled="status === 'pending'" @click="refresh()">Refresh runs</button></div>
    <p>Most recent starts first. Times use Melbourne time, including daylight saving.</p>
    <p>Passed counts successful output saves, either to the database or a file. Running is the last reported status, not proof a worker is still active.</p>
    <div class="run-filter"><label for="scraper-run-status">Run status</label>
      <select id="scraper-run-status" :value="typeof route.query.runStatus === 'string' ? route.query.runStatus : ''" @change="selectStatus">
        <option value="">All statuses</option><option v-for="value in scraperRunStatuses" :key="value" :value="value">{{ value }}</option>
      </select>
    </div>
    <p v-if="status === 'pending'" role="status">{{ runs ? 'Refreshing runs…' : 'Loading runs…' }}</p>
    <div v-if="error" class="admin-error" role="alert">
      <p>{{ error.statusCode === 400 ? 'The run status or page in this link is invalid.' : error.statusCode === 401 ? 'Your administrator session has expired. Sign in again.' : error.statusCode === 403 ? 'Administrator access is required.' : 'Run logs are temporarily unavailable. Please try again.' }}{{ runs ? ' Showing the last loaded results.' : '' }}</p>
      <button class="button button-secondary" type="button" :disabled="status === 'pending'" @click="refresh()">Retry runs</button>
    </div>
    <template v-if="runs">
      <p>{{ runs.total }} {{ runs.total === 1 ? 'run' : 'runs' }}{{ route.query.runStatus ? ' matching this status' : '' }}.</p>
      <p v-if="!runs.items.length">No scraper runs{{ route.query.runStatus ? ' match this status.' : ' have been recorded yet.' }}</p>
      <ul v-else class="run-list">
        <li v-for="run in runs.items" :key="run.id" class="admin-card">
          <h4><NuxtLink :to="{ query: { ...pageLink(runs.page).query, run: run.id } }">Run #{{ run.id }}</NuxtLink></h4>
          <AdminScraperRunSummary :run="run" :now="currentTime" />
          <NuxtLink :to="{ query: { ...pageLink(runs.page).query, run: run.id } }">View run<span class="sr-only"> #{{ run.id }}</span></NuxtLink>
        </li>
      </ul>
      <nav v-if="pages > 1" class="article-pagination" aria-label="Run pagination">
        <NuxtLink v-if="runs.page > 1" :to="pageLink(runs.page - 1)">Previous</NuxtLink><span>Page {{ runs.page }} of {{ pages }}</span><NuxtLink v-if="runs.page < pages" :to="pageLink(runs.page + 1)">Next</NuxtLink>
      </nav>
    </template>
  </div>
</template>
