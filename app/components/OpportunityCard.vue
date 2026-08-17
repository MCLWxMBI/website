<script setup lang="ts">
import type { Opportunity } from '~/types/opportunity'

const props = defineProps<{ opportunity: Opportunity; returnQuery?: Record<string, string> }>()
const formatDate = (date: string) => new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${date}T00:00:00`))
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
    <div class="tag-list" aria-label="Categories">
      <span v-for="tag in props.opportunity.tags.slice(0, 2)" :key="tag" class="tag">{{ tag }}</span>
    </div>
    <div class="card-footer">
      <div>
        <span class="date-label">{{ props.opportunity.status === 'upcoming' ? 'Opens' : 'Closes' }}</span>
        <strong>{{ props.opportunity.status === 'upcoming' ? formatDate(props.opportunity.openDate) : formatDate(props.opportunity.closeDate) }}</strong>
      </div>
      <NuxtLink class="card-arrow" :to="{ path: `/opportunities/${props.opportunity.id}`, query: props.returnQuery }" :aria-label="`View ${props.opportunity.title}`">
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7 4 6 6-6 6"/></svg>
      </NuxtLink>
    </div>
  </article>
</template>
