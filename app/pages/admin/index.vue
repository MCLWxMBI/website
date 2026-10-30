<script setup lang="ts">
import AdminWebsiteIndexes from '~/components/AdminWebsiteIndexes.vue'
import AdminScraper from '~/components/AdminScraper.vue'

definePageMeta({ layout: 'admin', middleware: 'admin' })
useSeoMeta({ title: 'Administration' })
const route = useRoute()
const tabs = ['pages', 'indexes', 'scraper', 'opportunities'] as const
type AdminTab = typeof tabs[number]
const selected = computed<AdminTab>(() => ['submissions', 'articles'].includes(route.query.tab as string) ? 'scraper' : tabs.includes(route.query.tab as AdminTab) ? route.query.tab as AdminTab : 'pages')
const tabLabels: Record<AdminTab, string> = { pages: 'Pages', indexes: 'Indexes', scraper: 'Scraper', opportunities: 'Opportunities' }
const pages: { title: string; path: string; editPath: string; description: string }[] = [
  { title: 'About', path: '/about', editPath: '/admin/pages/about', description: 'About ECHO, the MCLE initiative, and frequently asked questions.' },
  { title: 'Resources', path: '/resources', editPath: '/admin/pages/resources', description: 'Guidance for participating in public consultations.' }
]
</script>

<template>
  <section aria-labelledby="admin-title">
    <p class="admin-eyebrow">Temporary preview</p>
    <h1 id="admin-title">Administration</h1>
    <p class="admin-intro">Your starting point for managing ECHO’s pages and consultation listings.</p>
    <nav class="admin-tabs" aria-label="Administration areas">
      <NuxtLink v-for="tab in tabs" :key="tab" :to="{ query: { ...route.query, tab } }" :aria-current="selected === tab ? 'page' : undefined">{{ tabLabels[tab] }}</NuxtLink>
    </nav>
    <section id="panel-pages" :hidden="selected !== 'pages'" aria-labelledby="heading-pages">
      <h2 id="heading-pages">Static pages</h2>
      <div class="admin-page-grid">
        <article v-for="page in pages" :key="page.path" class="admin-card">
          <h3>{{ page.title }}</h3><p>{{ page.description }}</p>
          <div class="admin-card-actions">
            <NuxtLink :to="page.path" class="admin-view-link">View page<span class="sr-only">: {{ page.title }}</span></NuxtLink>
            <NuxtLink :to="page.editPath" class="button button-primary admin-edit-link">Edit page<span class="sr-only">: {{ page.title }}</span></NuxtLink>
          </div>
        </article>
      </div>
    </section>
    <section id="panel-indexes" :hidden="selected !== 'indexes'" aria-labelledby="heading-indexes">
      <AdminWebsiteIndexes />
    </section>
    <section v-if="selected === 'opportunities'" id="panel-opportunities" aria-labelledby="heading-opportunities">
      <h2 id="heading-opportunities">Opportunities</h2>
      <div class="admin-card">
        <h3>Add a consultation listing</h3>
        <p>Create a listing, review its preview, and publish it to the public catalogue.</p>
        <div class="admin-card-actions">
          <NuxtLink to="/admin/opportunities/new" class="button button-primary">Create opportunity</NuxtLink>
          <NuxtLink to="/">View public catalogue</NuxtLink>
        </div>
      </div>
    </section>
    <section v-if="selected === 'scraper'" id="panel-scraper" aria-labelledby="heading-scraper">
      <AdminScraper />
    </section>
  </section>
</template>
