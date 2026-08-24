<script setup lang="ts">
import { opportunities } from '~/data/opportunities'

const route = useRoute()
const opportunity = opportunities.find(item => item.id === route.params.id)
if (!opportunity) throw createError({ statusCode: 404, statusMessage: 'Opportunity not found' })

useSeoMeta({ title: opportunity.title, description: opportunity.summary })

const formatDate = (date: string) => new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${date}T00:00:00`))
const returnQuery = computed(() => Object.fromEntries(
  Object.entries(route.query).filter(([, value]) => typeof value === 'string')
) as Record<string, string>)
</script>

<template>
  <div class="detail-page">
    <div class="container">
      <NuxtLink :to="{ path: '/', query: returnQuery }" class="back-link">← Back to opportunities</NuxtLink>
      <div class="detail-layout">
        <article class="detail-main">
          <div class="detail-topline">
            <StatusBadge :status="opportunity.status" />
            <span>{{ opportunity.jurisdiction }}</span>
          </div>
          <p class="source-org">{{ opportunity.sourceOrg }}</p>
          <h1>{{ opportunity.title }}</h1>
          <p class="detail-lead">{{ opportunity.summary }}</p>
          <div class="tag-list detail-tags">
            <span v-for="tag in opportunity.tags" :key="tag" class="tag">{{ tag }}</span>
          </div>

          <section class="detail-section">
            <h2>About this consultation</h2>
            <p v-for="paragraph in opportunity.fullText" :key="paragraph">{{ paragraph }}</p>
          </section>

          <section v-if="opportunity.location" class="detail-section map-section">
            <h2>Area affected</h2>
            <p class="map-location-label">{{ opportunity.location.label }}</p>
            <ClientOnly>
              <OpportunityMap :location="opportunity.location" />
              <template #fallback>
                <div class="map-loading" role="status">Loading map of {{ opportunity.location.label }}…</div>
              </template>
            </ClientOnly>
          </section>

        </article>

        <aside class="detail-sidebar">
          <div class="deadline-card" :class="opportunity.status">
            <p>{{ opportunity.status === 'upcoming' ? 'Consultation opens' : opportunity.status === 'closed' ? 'Consultation closed' : 'Submissions close' }}</p>
            <strong>{{ formatDate(opportunity.status === 'upcoming' ? opportunity.openDate : opportunity.closeDate) }}</strong>
            <div class="date-range">
              <span><small>Opens</small>{{ formatDate(opportunity.openDate) }}</span>
              <span><small>Closes</small>{{ formatDate(opportunity.closeDate) }}</span>
            </div>
          </div>
          <a :href="opportunity.sourceUrl" class="button button-primary button-wide" target="_blank" rel="noopener">View original submission <span aria-hidden="true">↗</span></a>
          <p class="external-note">You’ll be taken to the publisher’s website.</p>
        </aside>
      </div>
    </div>
  </div>
</template>
