<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })
useSeoMeta({ title: 'Administration' })
const route = useRoute()
const router = useRouter()
const tabs = ['pages', 'submissions'] as const
type AdminTab = typeof tabs[number]
const selected = computed<AdminTab>(() => route.query.tab === 'submissions' ? 'submissions' : 'pages')
const pages: { title: string; path: string; editPath: string; description: string }[] = [
  { title: 'About', path: '/about', editPath: '/admin/pages/about', description: 'About ECHO, the MCLE initiative, and frequently asked questions.' },
  { title: 'Resources', path: '/resources', editPath: '/admin/pages/resources', description: 'Guidance for participating in public consultations.' }
]
async function selectTab(tab: AdminTab) {
  await router.push({ query: { ...route.query, tab } })
}
function moveTab(event: KeyboardEvent) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const tab = event.key === 'Home' ? 'pages' : event.key === 'End' ? 'submissions' : selected.value === 'pages' ? 'submissions' : 'pages'
  void selectTab(tab)
  document.getElementById(`tab-${tab}`)?.focus()
}
</script>

<template>
  <section aria-labelledby="admin-title">
    <p class="admin-eyebrow">Temporary preview</p>
    <h1 id="admin-title">Administration</h1>
    <p class="admin-intro">Your starting point for managing ECHO’s pages and consultation listings.</p>
    <div class="admin-tabs" role="tablist" aria-label="Administration areas" @keydown="moveTab">
      <button v-for="tab in tabs" :id="`tab-${tab}`" :key="tab" role="tab" :aria-selected="selected === tab" :aria-controls="`panel-${tab}`" :tabindex="selected === tab ? 0 : -1" @click="selectTab(tab)">{{ tab === 'pages' ? 'Pages' : 'Submissions' }}</button>
    </div>
    <section id="panel-pages" :hidden="selected !== 'pages'" role="tabpanel" aria-labelledby="tab-pages" tabindex="0">
      <h2>Static pages</h2>
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
    <section id="panel-submissions" :hidden="selected !== 'submissions'" role="tabpanel" aria-labelledby="tab-submissions" tabindex="0">
      <h2>Submissions</h2>
      <div class="admin-card"><h3>Consultation management coming soon</h3><p>This area will let administrators manage the consultation listings displayed on ECHO.</p></div>
    </section>
  </section>
</template>
