<script setup lang="ts">
import { formatOpportunityDate } from '~~/shared/utils/opportunity-deadline'
import { toOpportunity } from '~~/shared/utils/opportunity'
import type { OpportunityDetailResponse } from '~~/shared/types/opportunity'
import { getOpportunityTagGroups } from '~/utils/opportunity-access'
import { getOpportunityReturnQuery } from '~/utils/opportunity-authority'

const route = useRoute()
const { data, error, status: requestStatus, refresh } = await useFetch<OpportunityDetailResponse>(
  () => `/api/opportunities/${encodeURIComponent(String(route.params.id))}`
)
if (error.value) throw createError({
  statusCode: error.value.statusCode === 404 ? 404 : 503,
  statusMessage: error.value.statusCode === 404 ? 'Opportunity not found.' : 'Opportunities are temporarily unavailable.'
})
const opportunity = computed(() => data.value ? toOpportunity(data.value.opportunity) : null)
const websiteDetails = computed(() => data.value?.websiteTags ?? [])
const { currentTime } = await useServerTime()
const status = computed(() => opportunity.value ? getOpportunityStatus(opportunity.value, currentTime.value) : 'closed')
const tagGroups = computed(() => opportunity.value ? getOpportunityTagGroups(opportunity.value) : { categories: [], tags: [] })

useSeoMeta({ title: () => opportunity.value?.title, description: () => opportunity.value?.summary })

const formatDate = (date: string) => formatOpportunityDate(date, 'long')
const returnQuery = computed(() => getOpportunityReturnQuery(route.query))
</script>

<template>
  <div class="detail-page">
    <div class="container">
      <NuxtLink :to="{ path: '/', query: returnQuery }" class="back-link">← Back to opportunities</NuxtLink>
      <div v-if="requestStatus === 'pending'" class="empty-state" role="status" aria-live="polite">
        <p>Loading opportunity…</p>
      </div>
      <div v-else-if="error" class="empty-state" role="alert">
        <h1>{{ error.statusCode === 404 ? 'Opportunity not found' : 'Opportunity unavailable' }}</h1>
        <p>{{ error.statusCode === 404 ? 'This opportunity could not be found.' : 'Please try again shortly.' }}</p>
        <button v-if="error.statusCode !== 404" class="button button-primary" type="button" @click="refresh()">Try again</button>
      </div>
      <div v-else-if="opportunity" class="detail-layout">
        <article class="detail-main">
          <div class="detail-topline">
            <StatusBadge :status="status" />
            <span>{{ opportunity.jurisdiction }}</span>
          </div>
          <p class="source-org">{{ opportunity.sourceOrg }}</p>
          <h1>{{ opportunity.title }}</h1>
          <p class="detail-lead">{{ opportunity.summary }}</p>
          <div class="detail-tag-groups">
            <div class="tag-list detail-tags" aria-label="Categories">
              <span v-for="category in tagGroups.categories" :key="category" class="tag">{{ category }}</span>
            </div>
            <div v-if="tagGroups.tags.length" class="tag-list detail-tags opportunity-tags" aria-label="Tags">
              <span v-for="tag in tagGroups.tags" :key="tag" class="tag opportunity-tag">{{ tag }}</span>
            </div>
          </div>

          <section class="detail-section">
            <h2>About this consultation</h2>
            <p v-for="paragraph in opportunity.fullText" :key="paragraph">{{ paragraph }}</p>
          </section>

          <section v-if="opportunity.location" class="detail-section map-section">
            <h2>Area affected</h2>
            <p class="map-location-label">{{ opportunity.location.label }}</p>
            <ClientOnly>
              <OpportunityMap :key="JSON.stringify(opportunity.location)" :location="opportunity.location" />
              <template #fallback>
                <div class="map-loading" role="status">Loading map of {{ opportunity.location.label }}…</div>
              </template>
            </ClientOnly>
          </section>

        </article>

        <aside class="detail-sidebar">
          <div class="deadline-card" :class="status">
            <p>Website features</p>
            <ul class="website-details">
              <li v-for="detail in websiteDetails" :key="detail">{{ detail }}</li>
            </ul>
            <div class="date-range">
              <span v-if="opportunity.startDate"><small>Opens</small>{{ formatDate(opportunity.startDate) }}</span>
              <span><small>Closes</small>{{ formatDate(opportunity.submissionDeadline) }}</span>
            </div>
          </div>
          <a :href="opportunity.sourceUrl" class="button button-primary button-wide" target="_blank" rel="noopener">View original submission <span aria-hidden="true">↗</span></a>
          <p class="external-note">You’ll be taken to the publisher’s website.</p>
        </aside>
      </div>
    </div>
  </div>
</template>
