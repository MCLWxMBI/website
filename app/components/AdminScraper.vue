<script setup lang="ts">
import AdminScraperSources from './AdminScraperSources.vue'
import AdminScraperRuns from './AdminScraperRuns.vue'
const route = useRoute()
const runs = computed(() => route.query.view === 'runs')
</script>

<template>
  <div>
    <h2 id="heading-scraper">Scraper</h2>
    <nav class="admin-tabs" aria-label="Scraper views">
      <NuxtLink :to="{ query: { tab: 'scraper' } }" :aria-current="!runs ? 'page' : undefined">Sources</NuxtLink>
      <NuxtLink :to="{ query: { tab: 'scraper', view: 'runs' } }" :aria-current="runs ? 'page' : undefined">Runs</NuxtLink>
    </nav>
    <AdminScraperSources v-show="!runs" />
    <AdminScraperRuns v-if="runs" />
  </div>
</template>

<style>
.run-heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; }
.run-list { list-style: none; display: grid; gap: 1rem; padding: 0; }
.scraper-runs .article-pagination { display: flex; justify-content: center; flex-wrap: wrap; gap: 1rem; margin-block: 1.5rem; }
.run-list h4 { font-size: 1.1rem; margin: 0 0 .75rem; }
.run-list .article-url { overflow-wrap: anywhere; }
.run-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(145px, 1fr)); gap: .8rem 1rem; }
.run-summary dt { color: var(--muted); font-size: .85rem; }
.run-summary dd { margin: .2rem 0 0; overflow-wrap: anywhere; }
.run-status { display: inline-block; padding: .15rem .5rem; border-radius: 5px; text-transform: capitalize; background: #edf0ee; color: #35433a; }
.run-status.passed { background: #dff7ec; color: #08794f; }
.run-status.failed { background: #fbe8e8; color: #922828; }
.run-status.running { background: #fff1cc; color: #795004; }
.run-filter { display: grid; gap: .4rem; margin-block: .8rem; font-weight: 600; }
.run-filter input, .run-filter select { min-width: 0; padding: .65rem; border: 1px solid var(--line); border-radius: 6px; font: inherit; background: white; color: var(--ink); }
.run-filters { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
.run-source-error { white-space: pre-wrap; overflow-wrap: anywhere; color: #922828; }
.run-list details { margin-top: 1rem; overflow-wrap: anywhere; }
.run-list summary { cursor: pointer; font-weight: 600; }
</style>
