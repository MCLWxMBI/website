<script setup lang="ts">
import type { OpportunityWithStatus } from '~/types/opportunity'
import { getOpportunityTagGroups } from '~/utils/opportunity-access'

const props = defineProps<{ opportunity: OpportunityWithStatus; returnQuery?: Record<string, string> }>()
const tagGroups = computed(() => getOpportunityTagGroups(props.opportunity, 2))
const formatDate = (date: string) => new Intl.DateTimeFormat('en-AU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC'
}).format(new Date(date))
</script>

<template>
  <article class="opportunity-card">
    <div class="card-topline">
      <StatusBadge :status="props.opportunity.status" />
      <span class="jurisdiction">{{ props.opportunity.jurisdiction }}</span>
    </div>
    <div class="card-content">
      <p class="source-org">{{ props.opportunity.sourceOrg }}</p>
      <h2>
        <NuxtLink :to="{ path: `/opportunities/${props.opportunity.id}`, query: props.returnQuery }">
          {{ props.opportunity.title }}
        </NuxtLink>
      </h2>
      <p class="card-summary">{{ props.opportunity.summary }}</p>
    </div>
    <div class="card-tag-groups">
      <div class="tag-list" aria-label="Categories">
        <span v-for="category in tagGroups.categories" :key="category" class="tag">{{ category }}</span>
      </div>
      <div v-if="tagGroups.tags.length" class="tag-list opportunity-tags" aria-label="Tags">
        <span v-for="tag in tagGroups.tags" :key="tag" class="tag opportunity-tag">{{ tag }}</span>
      </div>
    </div>
    <div class="card-footer">
      <div>
        <span class="date-label">{{ props.opportunity.status === 'upcoming' ? 'Opens' : 'Closes' }}</span>
        <strong>{{ props.opportunity.status === 'upcoming' && props.opportunity.startDate
          ? formatDate(props.opportunity.startDate)
          : formatDate(props.opportunity.submissionDeadline) }}</strong>
      </div>
      <NuxtLink class="card-arrow" :to="{ path: `/opportunities/${props.opportunity.id}`, query: props.returnQuery }" :aria-label="`View ${props.opportunity.title}`">
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7 4 6 6-6 6"/></svg>
      </NuxtLink>
    </div>
  </article>
</template>
