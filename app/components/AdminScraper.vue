<script setup lang="ts">
import type { AdminScraperSourcesResponse } from '~~/shared/types/admin-scraper'
import AdminScraperArticles from './AdminScraperArticles.vue'

const route = useRoute()
const sourceKey = computed(() => typeof route.query.source === 'string' ? route.query.source : '')
const { data, error, status, refresh } = await useFetch<AdminScraperSourcesResponse>('/api/admin/scraper/sources')
const sourceName = computed(() => sourceKey.value === 'unassigned'
  ? 'Unassigned articles'
  : data.value?.sources.find(source => source.id === sourceKey.value)?.name ?? 'Source articles')
</script>

<template>
  <div>
    <h2 id="heading-scraper">Scraper</h2>
    <p>Browse all tracked articles, including deleted articles and those without a successful scrape.</p>
    <p v-if="status === 'pending'" role="status">Loading sources…</p>
    <div v-else-if="error" class="admin-card" role="alert">
      <p>Sources are temporarily unavailable. Please try again.</p>
      <button type="button" class="button button-secondary" @click="refresh()">Retry sources</button>
    </div>
    <AdminScraperArticles v-else-if="sourceKey" :key="sourceKey" :source="sourceKey" :source-name="sourceName" />
    <template v-else-if="data">
      <p v-if="!data.sources.length && !data.unassignedCount">No sources or tracked articles yet.</p>
      <ul v-else class="article-sources">
        <li v-for="source in data.sources" :key="source.id" class="admin-card">
          <h3><NuxtLink :to="{ query: { tab: 'scraper', source: source.id } }">{{ source.name }}</NuxtLink></h3>
          <a :href="source.indexUrl" target="_blank" rel="noopener noreferrer" class="article-url">{{ source.indexUrl }}<span class="sr-only"> (opens in a new tab)</span></a>
          <p>{{ source.active ? 'Active' : 'Inactive' }} · {{ source.articleCount }} {{ source.articleCount === 1 ? 'article' : 'articles' }}</p>
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
.article-sources { display: grid; gap: 16px; padding: 0; list-style: none; }
.article-sources h3 { margin-bottom: 8px; }
.article-sources p { margin-bottom: 0; }
.article-url { overflow-wrap: anywhere; }
</style>
