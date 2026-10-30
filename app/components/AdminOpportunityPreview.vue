<script setup lang="ts">
import type { CreateOpportunityRequest } from '~~/shared/types/admin-opportunity'
import { toOpportunity } from '~~/shared/utils/opportunity'
import { formatOpportunityDate } from '~~/shared/utils/opportunity-deadline'
import { getOpportunityStatus } from '~/utils/opportunity-status'
import { getOpportunityTagGroups } from '~/utils/opportunity-access'
const props = defineProps<{ request: CreateOpportunityRequest; organisationName: string; websiteTags: string[]; currentTime: number }>()
const opportunity = computed(() => toOpportunity({ ...props.request, id: 'preview', sourceOrg: props.organisationName, website: 'preview' }))
const status = computed(() => getOpportunityStatus(opportunity.value, props.currentTime))
const tags = computed(() => getOpportunityTagGroups(opportunity.value))
</script>

<template>
  <article class="admin-card opportunity-preview" aria-labelledby="preview-title">
    <p>This is a preview. The listing has not been published.</p>
    <div class="preview-meta"><StatusBadge :status="status" /><span>{{ opportunity.jurisdiction }}</span></div>
    <p>{{ opportunity.sourceOrg }}</p>
    <h2 id="preview-title">{{ opportunity.title }}</h2>
    <p class="preview-summary">{{ opportunity.summary }}</p>
    <div class="tag-list" aria-label="Categories"><span v-for="tag in tags.categories" :key="tag" class="tag">{{ tag }}</span></div>
    <div v-if="tags.tags.length" class="tag-list" aria-label="Opportunity tags"><span v-for="tag in tags.tags" :key="tag" class="tag">{{ tag }}</span></div>
    <h3>About this consultation</h3>
    <p v-for="(paragraph, index) in opportunity.fullText" :key="index">{{ paragraph }}</p>
    <dl>
      <template v-if="opportunity.startDate"><dt>Opens (UTC)</dt><dd>{{ formatOpportunityDate(opportunity.startDate, 'long') }}</dd></template>
      <dt>Closes (UTC)</dt><dd>{{ formatOpportunityDate(opportunity.submissionDeadline, 'long') }}</dd>
    </dl>
    <h3>Website features</h3>
    <ul v-if="websiteTags.length"><li v-for="tag in websiteTags" :key="tag">{{ tag }}</li></ul>
    <p v-else>No website features supplied.</p>
    <a :href="opportunity.sourceUrl" target="_blank" rel="noopener noreferrer">Official consultation page<span class="sr-only"> (opens in a new tab)</span></a>
    <section v-if="opportunity.location">
      <h3>Area affected</h3><p>{{ opportunity.location.label }}</p>
      <ClientOnly><OpportunityMap :key="JSON.stringify(opportunity.location)" :location="opportunity.location" /><template #fallback><p>Loading map…</p></template></ClientOnly>
    </section>
  </article>
</template>

<style scoped>
.preview-meta { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; }
.preview-summary { font-size: 1.15rem; }
.tag-list { margin-block: 12px; }
dt { font-weight: 700; } dd { margin: 0 0 12px; }
.opportunity-preview { overflow-wrap: anywhere; }
</style>
