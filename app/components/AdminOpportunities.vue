<script setup lang="ts">
import type { AdminOpportunityList } from '~~/shared/types/admin-opportunity-management'
import type { AdminOpportunityOptionsResponse } from '~~/shared/types/admin-opportunity'
import { formatOpportunityDate } from '~~/shared/utils/opportunity-deadline'
import { getOpportunityStatus } from '~/utils/opportunity-status'
const route = useRoute()
const router = useRouter()
const { currentTime } = await useServerTime()
const text = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback
const query = computed(() => ({ q: text(route.query.opportunityQ), source: text(route.query.opportunitySource),
  status: text(route.query.opportunityStatus, 'all'), deleted: text(route.query.opportunityDeleted, 'false'), page: text(route.query.opportunityPage, '1') }))
const search = ref(query.value.q)
const { data, status, error, refresh } = await useFetch<AdminOpportunityList>('/api/admin/opportunities', { query })
const { data: options, error: optionsError, refresh: refreshOptions } = await useFetch<AdminOpportunityOptionsResponse>('/api/admin/opportunities/options')
const pages = computed(() => Math.max(1, Math.ceil((data.value?.total ?? 0) / (data.value?.pageSize ?? 25))))
const notice = ref('')
function filter(key: string, value: string) {
  return router.push({ query: { ...route.query, tab: 'opportunities', [key]: value || undefined, opportunityPage: undefined } })
}
function pageLink(page: number) { return { query: { ...route.query, tab: 'opportunities', opportunityPage: String(page) } } }
let timer: ReturnType<typeof setTimeout> | undefined
function updateSearch() {
  clearTimeout(timer)
  if (search.value !== query.value.q) void filter('opportunityQ', search.value)
}
watch(search, () => { clearTimeout(timer); timer = setTimeout(updateSearch, 300) })
watch(() => query.value.q, value => { clearTimeout(timer); search.value = value })
onBeforeUnmount(() => clearTimeout(timer))
async function deleted() { notice.value = 'Listing deleted from the public website. Its content is available under Deleted.'; await refresh() }
</script>

<template>
  <div class="opportunity-manager">
    <p v-if="notice" role="status">{{ notice }}</p>
    <form class="list-filters admin-card" role="search" @submit.prevent="updateSearch">
      <div><label for="opportunity-search">Search titles</label><input id="opportunity-search" v-model="search" type="search" maxlength="200"><button type="submit" class="button button-secondary">Search</button></div>
      <div><label for="opportunity-source-filter">Source</label><select id="opportunity-source-filter" :value="query.source" @change="filter('opportunitySource', ($event.target as HTMLSelectElement).value)"><option value="">All sources</option><option v-for="source in options?.sources ?? []" :key="source.id" :value="source.id">{{ source.name }} — {{ source.indexUrl }}</option></select></div>
      <div><label for="opportunity-status-filter">Status</label><select id="opportunity-status-filter" :value="query.status" @change="filter('opportunityStatus', ($event.target as HTMLSelectElement).value)"><option value="all">All statuses</option><option value="upcoming">Upcoming</option><option value="open">Open</option><option value="closed">Closed</option></select></div>
      <div><label for="opportunity-visibility-filter">Listings</label><select id="opportunity-visibility-filter" :value="query.deleted" @change="filter('opportunityDeleted', ($event.target as HTMLSelectElement).value)"><option value="false">Published</option><option value="true">Deleted</option></select></div>
    </form>
    <p v-if="optionsError" role="alert">Source filters could not be loaded. <button type="button" @click="refreshOptions()">Retry source filters</button></p>
    <p v-if="status === 'pending'" role="status">Loading opportunities…</p>
    <div v-else-if="error" class="admin-card" role="alert"><p>{{ error.statusCode === 400 ? 'The filters in this link are invalid.' : 'Opportunities are temporarily unavailable.' }}</p><button type="button" class="button button-secondary" @click="refresh()">Retry opportunities</button><NuxtLink :to="{ path: '/admin', query: { tab: 'opportunities' } }">Reset filters</NuxtLink></div>
    <template v-else-if="data">
      <p role="status">{{ data.total }} {{ data.total === 1 ? 'opportunity' : 'opportunities' }}. Closing date, earliest first.</p>
      <p v-if="!data.items.length">No {{ query.deleted === 'true' ? 'deleted' : 'published' }} opportunities match these filters.</p>
      <ul v-else class="listing-list">
        <li v-for="listing in data.items" :key="listing.opportunity.id" class="admin-card">
          <h3><NuxtLink :to="`/admin/opportunities/${encodeURIComponent(listing.opportunity.id)}`">{{ listing.opportunity.title }}</NuxtLink></h3>
          <p>{{ listing.opportunity.sourceOrg }}</p>
          <p>{{ listing.deleted ? 'Deleted · ' : '' }}<StatusBadge :status="getOpportunityStatus(listing.opportunity, currentTime)" /> · Closes {{ formatOpportunityDate(listing.opportunity.submissionDeadline, 'long') }}</p>
          <div class="listing-actions">
            <NuxtLink :to="`/admin/opportunities/${encodeURIComponent(listing.opportunity.id)}`">{{ listing.deleted ? 'View retained listing' : 'View' }}</NuxtLink>
            <template v-if="!listing.deleted"><NuxtLink :to="`/admin/opportunities/${encodeURIComponent(listing.opportunity.id)}/edit`" class="button button-primary">Edit<span class="sr-only"> {{ listing.opportunity.title }}</span></NuxtLink><AdminOpportunityDelete :listing="listing" @deleted="deleted" /></template>
          </div>
        </li>
      </ul>
      <nav v-if="pages > 1" class="listing-actions pagination" aria-label="Opportunity pagination"><NuxtLink v-if="data.page > 1" :to="pageLink(data.page - 1)">Previous</NuxtLink><span>Page {{ data.page }} of {{ pages }}</span><NuxtLink v-if="data.page < pages" :to="pageLink(data.page + 1)">Next</NuxtLink></nav>
    </template>
  </div>
</template>

<style scoped>
.opportunity-manager { margin-top: 24px; }
.list-filters { display: flex; flex-wrap: wrap; gap: 20px; }
.list-filters > div { flex: 1 1 200px; min-width: 0; }
.list-filters label { display: block; font-weight: 700; margin-bottom: 8px; }
.list-filters input, .list-filters select { width: 100%; padding: 10px; border: 1px solid var(--line); border-radius: 6px; font: inherit; }
.list-filters button { margin-top: 8px; }
.listing-list { list-style: none; padding: 0; display: grid; gap: 16px; }
.listing-list h3 { margin-top: 0; overflow-wrap: anywhere; }
.listing-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; }
.pagination { justify-content: center; margin-block: 24px; }
</style>
