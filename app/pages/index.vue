<script setup lang="ts">
import { opportunities } from '~/data/opportunities'
import { jurisdictions, opportunityCategories, opportunityStatuses } from '~/types/opportunity'
import type { Jurisdiction, OpportunityCategory, OpportunityStatus } from '~/types/opportunity'

useSeoMeta({ title: 'Consultation opportunities' })

const route = useRoute()
const router = useRouter()
const pageSize = 6
const mobileFiltersOpen = ref(false)

const value = (key: string) => typeof route.query[key] === 'string' ? route.query[key] as string : ''
const validList = <T extends string>(raw: string, valid: readonly T[]) =>
  raw.split(',').filter((item): item is T => valid.includes(item as T))

const search = ref(value('q'))
const selectedJurisdictions = ref<Jurisdiction[]>(validList(value('location'), jurisdictions))
const selectedCategories = ref<OpportunityCategory[]>(validList(value('category'), opportunityCategories))
const selectedStatuses = ref<OpportunityStatus[]>(validList(value('status'), opportunityStatuses))
const page = ref(Math.max(1, Number(value('page')) || 1))

const queryState = computed<Record<string, string>>(() => {
  const query: Record<string, string> = {}
  if (search.value.trim()) query.q = search.value.trim()
  if (selectedJurisdictions.value.length) query.location = selectedJurisdictions.value.join(',')
  if (selectedCategories.value.length) query.category = selectedCategories.value.join(',')
  if (selectedStatuses.value.length) query.status = selectedStatuses.value.join(',')
  if (page.value > 1) query.page = String(page.value)
  return query
})

const syncUrl = () => router.replace({ query: queryState.value })
const resetPageAndSync = () => { page.value = 1; syncUrl() }

const toggle = <T,>(list: Ref<T[]>, item: T) => {
  list.value = list.value.includes(item)
    ? list.value.filter(value => value !== item)
    : [...list.value, item]
  resetPageAndSync()
}

const clearFilters = () => {
  selectedJurisdictions.value = []
  selectedCategories.value = []
  selectedStatuses.value = []
  resetPageAndSync()
}

const clearEverything = () => {
  search.value = ''
  clearFilters()
}

const filtered = computed(() => {
  const term = search.value.trim().toLocaleLowerCase()
  return opportunities.filter((item) => {
    const haystack = [item.title, item.summary, item.sourceOrg, item.jurisdiction, ...item.tags].join(' ').toLocaleLowerCase()
    return (!term || haystack.includes(term))
      && (!selectedJurisdictions.value.length || selectedJurisdictions.value.includes(item.jurisdiction))
      && (!selectedCategories.value.length || item.tags.some(tag => selectedCategories.value.includes(tag)))
      && (!selectedStatuses.value.length || selectedStatuses.value.includes(item.status))
  })
})

const pageCount = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize)))
const visibleOpportunities = computed(() => filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize))
const hasAnyFilter = computed(() => Boolean(search.value || selectedJurisdictions.value.length || selectedCategories.value.length || selectedStatuses.value.length))
const activeFilterCount = computed(() => selectedJurisdictions.value.length + selectedCategories.value.length + selectedStatuses.value.length)

const goToPage = (nextPage: number) => {
  page.value = Math.min(Math.max(1, nextPage), pageCount.value)
  syncUrl()
  window.scrollTo({ top: 430, behavior: 'smooth' })
}

watch(search, resetPageAndSync)
watch(pageCount, count => { if (page.value > count) goToPage(count) })
</script>

<template>
  <div>
    <section class="hero">
      <div class="container hero-inner">
        <div class="eyebrow"><span></span> Environmental policy, in one place</div>
        <h1>Find your opportunity<br>to <em>shape change.</em></h1>
        <p>Discover consultations on the environmental decisions that matter, before the submission window closes.</p>
        <label class="hero-search">
          <span class="sr-only">Search opportunities</span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>
          <input v-model="search" type="search" placeholder="Search by topic, organisation or keyword">
          <kbd>⌘ K</kbd>
        </label>
        <div class="hero-meta">
          <span><i class="live-dot"></i> {{ opportunities.filter(item => item.status === 'open').length }} opportunities open now</span>
          <span>Victoria & Commonwealth</span>
        </div>
      </div>
      <div class="hero-orb hero-orb-one"></div>
      <div class="hero-orb hero-orb-two"></div>
    </section>

    <section class="listing-section">
      <div class="container">
        <div class="listing-toolbar">
          <div>
            <p class="section-kicker">Browse opportunities</p>
            <h2>{{ filtered.length }} {{ filtered.length === 1 ? 'result' : 'results' }}</h2>
          </div>
          <button class="filter-trigger" type="button" @click="mobileFiltersOpen = true">
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5h14M5 10h10M8 15h4"/></svg>
            Filters <span v-if="activeFilterCount">{{ activeFilterCount }}</span>
          </button>
        </div>

        <div class="listing-layout">
          <aside class="filter-sidebar">
            <OpportunityFilters
              :selected-jurisdictions="selectedJurisdictions"
              :selected-categories="selectedCategories"
              :selected-statuses="selectedStatuses"
              @toggle-jurisdiction="toggle(selectedJurisdictions, $event)"
              @toggle-category="toggle(selectedCategories, $event)"
              @toggle-status="toggle(selectedStatuses, $event)"
              @clear="clearFilters"
            />
          </aside>

          <div class="results-column">
            <div v-if="visibleOpportunities.length" class="opportunity-grid">
              <OpportunityCard v-for="item in visibleOpportunities" :key="item.id" :opportunity="item" :return-query="queryState" />
            </div>
            <div v-else class="empty-state">
              <span class="empty-icon" aria-hidden="true">⌕</span>
              <h2>No opportunities found</h2>
              <p>Try broadening your search or removing a filter.</p>
              <button v-if="hasAnyFilter" class="button button-primary" type="button" @click="clearEverything">Clear search and filters</button>
            </div>

            <nav v-if="filtered.length > pageSize" class="pagination" aria-label="Results pages">
              <button type="button" :disabled="page === 1" aria-label="Previous page" @click="goToPage(page - 1)">←</button>
              <button v-for="number in pageCount" :key="number" type="button" :class="{ active: number === page }" :aria-current="number === page ? 'page' : undefined" @click="goToPage(number)">{{ number }}</button>
              <button type="button" :disabled="page === pageCount" aria-label="Next page" @click="goToPage(page + 1)">→</button>
            </nav>
          </div>
        </div>
      </div>
    </section>

    <div v-if="mobileFiltersOpen" class="drawer-backdrop" role="presentation" @click.self="mobileFiltersOpen = false">
      <aside class="filter-drawer" role="dialog" aria-modal="true" aria-label="Filter opportunities">
        <button class="drawer-close" type="button" aria-label="Close filters" @click="mobileFiltersOpen = false">×</button>
        <OpportunityFilters
          :selected-jurisdictions="selectedJurisdictions"
          :selected-categories="selectedCategories"
          :selected-statuses="selectedStatuses"
          @toggle-jurisdiction="toggle(selectedJurisdictions, $event)"
          @toggle-category="toggle(selectedCategories, $event)"
          @toggle-status="toggle(selectedStatuses, $event)"
          @clear="clearFilters"
        />
        <button class="button button-primary drawer-apply" type="button" @click="mobileFiltersOpen = false">Show {{ filtered.length }} results</button>
      </aside>
    </div>
  </div>
</template>
