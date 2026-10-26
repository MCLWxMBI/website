<script setup lang="ts">
import type { AdminScraperArticle, AdminScraperArticlesResponse } from '~~/shared/types/admin-scraper'

const props = defineProps<{ source: string; sourceName: string }>()
const route = useRoute()
const router = useRouter()
const routeSearch = computed(() => typeof route.query.q === 'string' ? route.query.q : '')
const search = ref(routeSearch.value)
const query = computed(() => ({ source: props.source, q: routeSearch.value, page: route.query.page ?? '1' }))
const { data, error, status, refresh } = await useFetch<AdminScraperArticlesResponse>('/api/admin/scraper/articles', { query })
const pages = computed(() => Math.max(1, Math.ceil((data.value?.total ?? 0) / (data.value?.pageSize ?? 25))))
const errorMessage = computed(() => error.value?.statusCode === 404 ? 'This source no longer exists.'
  : error.value?.statusCode === 400 ? 'The source, search, or page in this link is invalid.'
    : 'Articles are temporarily unavailable. Please try again.')
let timer: ReturnType<typeof setTimeout> | undefined
function updateSearch() {
  clearTimeout(timer)
  if (search.value === routeSearch.value) return
  void router.push({ query: { tab: 'scraper', source: props.source, ...(search.value ? { q: search.value } : {}) } })
}
watch(search, () => { clearTimeout(timer); timer = setTimeout(updateSearch, 300) })
watch(routeSearch, value => { clearTimeout(timer); search.value = value })
onBeforeUnmount(() => clearTimeout(timer))
function pageLink(page: number) {
  return { query: { tab: 'scraper', source: props.source, ...(routeSearch.value ? { q: routeSearch.value } : {}), page: String(page) } }
}
function articleStatus(article: AdminScraperArticle) {
  return article.deleted ? 'Deleted' : article.hasSuccessfulScrape ? 'Scraped' : 'Tracked — no successful scrape recorded'
}
function uploadDate(value: string | null) {
  if (!value) return 'Date unknown'
  return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
}
</script>

<template>
  <div>
    <NuxtLink :to="{ query: { tab: 'scraper' } }">← Back to sources</NuxtLink>
    <h3>{{ sourceName }}</h3>
    <form class="article-search" role="search" @submit.prevent="updateSearch">
      <label for="article-title-search">Search article titles</label>
      <div><input id="article-title-search" v-model="search" type="search" maxlength="200" placeholder="Search by title"><button type="submit" class="button button-secondary">Search</button></div>
    </form>
    <p v-if="status === 'pending'" role="status">Loading articles…</p>
    <div v-else-if="error" class="admin-card" role="alert">
      <p>{{ errorMessage }}</p>
      <button type="button" class="button button-secondary" @click="refresh()">Retry articles</button>
    </div>
    <template v-else-if="data">
      <p role="status">{{ data.total }} {{ data.total === 1 ? 'article' : 'articles' }}{{ routeSearch ? ' matching your search' : '' }}. Most recent upload dates first.</p>
      <p v-if="!data.items.length">{{ routeSearch ? 'No articles match this title search.' : 'No articles have been tracked for this source yet.' }}</p>
      <ul v-else class="article-list">
        <li v-for="article in data.items" :key="article.sourceUrl" class="admin-card">
          <h4><a :href="article.sourceUrl" target="_blank" rel="noopener noreferrer">{{ article.title }}<span class="sr-only"> (opens in a new tab)</span></a></h4>
          <p class="article-url">{{ article.sourceUrl }}</p>
          <p>Uploaded: <time v-if="article.uploadDate" :datetime="article.uploadDate">{{ uploadDate(article.uploadDate) }}</time><span v-else>Date unknown</span></p>
          <p>{{ articleStatus(article) }}</p>
          <NuxtLink v-if="article.opportunityId" :to="`/opportunities/${encodeURIComponent(article.opportunityId)}`">View opportunity</NuxtLink>
        </li>
      </ul>
      <nav v-if="pages > 1" aria-label="Article pagination" class="article-pagination">
        <NuxtLink v-if="data.page > 1" :to="pageLink(data.page - 1)">Previous</NuxtLink>
        <span>Page {{ data.page }} of {{ pages }}</span>
        <NuxtLink v-if="data.page < pages" :to="pageLink(data.page + 1)">Next</NuxtLink>
      </nav>
    </template>
  </div>
</template>

<style scoped>
.article-search { margin-block: 24px; }
.article-search label { display: block; font-weight: 700; margin-bottom: 8px; }
.article-search div { display: flex; flex-wrap: wrap; gap: 12px; }
.article-search input { flex: 1 1 220px; min-width: 0; padding: 12px; border: 1px solid var(--line); border-radius: 6px; font: inherit; }
.article-list { display: grid; gap: 16px; padding: 0; list-style: none; }
.article-list h4 { margin: 0 0 8px; font-size: 1.15rem; }
.article-url { overflow-wrap: anywhere; font-size: .9rem; }
.article-pagination { display: flex; align-items: center; justify-content: center; gap: 24px; margin-block: 24px; }
</style>
