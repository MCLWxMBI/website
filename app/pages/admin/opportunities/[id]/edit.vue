<script setup lang="ts">
import type { AdminOpportunityDetail } from '~~/shared/types/admin-opportunity-management'
definePageMeta({ layout: 'admin', middleware: 'admin', key: route => route.path })
useSeoMeta({ title: 'Edit opportunity' })
const route = useRoute()
const { data, error, status, refresh } = await useFetch<AdminOpportunityDetail>(`/api/admin/opportunities/${encodeURIComponent(String(route.params.id))}`)
</script>

<template>
  <div v-if="status === 'pending'" role="status">Loading opportunity…</div>
  <div v-else-if="error" class="admin-card" role="alert"><p>{{ error.statusCode === 404 ? 'Opportunity not found.' : 'This listing is temporarily unavailable.' }}</p><button v-if="error.statusCode !== 404" type="button" class="button button-secondary" @click="refresh()">Retry listing</button><NuxtLink to="/admin?tab=opportunities">Back to Opportunities</NuxtLink></div>
  <div v-else-if="data?.deleted" class="admin-card"><h1>Deleted opportunity</h1><p>Deleted listings are read-only.</p><NuxtLink :to="`/admin/opportunities/${encodeURIComponent(data.opportunity.id)}`">View retained listing</NuxtLink></div>
  <AdminOpportunityForm v-else-if="data" :key="data.version" :listing="data" />
</template>
