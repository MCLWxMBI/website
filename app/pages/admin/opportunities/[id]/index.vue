<script setup lang="ts">
import type { AdminOpportunityDetail } from '~~/shared/types/admin-opportunity-management'
definePageMeta({ layout: 'admin', middleware: 'admin', key: route => route.path })
useSeoMeta({ title: 'Opportunity details' })
const route = useRoute()
const { currentTime } = await useServerTime()
const { data, error, status, refresh } = await useFetch<AdminOpportunityDetail>(`/api/admin/opportunities/${encodeURIComponent(String(route.params.id))}`)
const request = computed(() => data.value ? { ...data.value.opportunity, organisation: { existingId: data.value.opportunity.website } } : null)
</script>

<template>
  <section>
    <NuxtLink :to="{ path: '/admin', query: { tab: 'opportunities', ...(data?.deleted ? { opportunityDeleted: 'true' } : {}) } }">← Back to Opportunities</NuxtLink>
    <h1>{{ data?.deleted ? 'Deleted opportunity' : 'Opportunity details' }}</h1>
    <p v-if="status === 'pending'" role="status">Loading opportunity…</p>
    <div v-else-if="error" class="admin-card" role="alert"><p>{{ error.statusCode === 404 ? 'Opportunity not found.' : 'This listing is temporarily unavailable.' }}</p><button v-if="error.statusCode !== 404" type="button" class="button button-secondary" @click="refresh()">Retry listing</button></div>
    <template v-else-if="data && request">
      <p v-if="data.deleted" role="status">Deleted from the public website. This retained content is read-only. The scraper will skip this URL.</p>
      <div v-else class="listing-actions"><NuxtLink :to="`/opportunities/${encodeURIComponent(data.opportunity.id)}`">View public listing</NuxtLink><NuxtLink :to="`/admin/opportunities/${encodeURIComponent(data.opportunity.id)}/edit`" class="button button-primary">Edit opportunity</NuxtLink><AdminOpportunityDelete :listing="data" @deleted="refresh()" /></div>
      <AdminOpportunityPreview :request="request" :organisation-name="data.opportunity.sourceOrg" :website-tags="data.websiteTags" :current-time="currentTime" :notice="data.deleted ? 'Stored listing at deletion. Earlier versions are not retained.' : 'This is the saved listing.'" />
    </template>
  </section>
</template>

<style scoped>
.listing-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; margin-block: 24px; }
</style>
