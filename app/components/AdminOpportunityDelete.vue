<script setup lang="ts">
import type { AdminOpportunityDetail } from '~~/shared/types/admin-opportunity-management'
const props = defineProps<{ listing: AdminOpportunityDetail }>()
const emit = defineEmits<{ deleted: [] }>()
const { $csrfFetch } = useNuxtApp()
const saving = ref(false)
const error = ref('')
async function remove() {
  if (saving.value || !window.confirm(`Delete “${props.listing.opportunity.title}” from the public website? Its stored content will remain available to administrators and the scraper will skip this URL.`)) return
  saving.value = true
  error.value = ''
  try {
    await $csrfFetch(`/api/admin/opportunities/${encodeURIComponent(props.listing.opportunity.id)}`, { method: 'DELETE', body: { expectedVersion: props.listing.version } })
    emit('deleted')
  } catch (cause) {
    const status = (cause as { statusCode?: number }).statusCode
    error.value = status === 409 ? 'This listing changed or was deleted. Reload it before trying again.'
      : status === 401 ? 'Your session expired. Sign in again before deleting.'
        : status === 403 ? 'Your security token could not be verified. Reload before trying again.'
          : 'The listing could not be deleted. Please try again.'
  } finally { saving.value = false }
}
</script>

<template>
  <span class="delete-control">
    <button type="button" class="button button-secondary" :disabled="saving" :aria-label="`Delete ${listing.opportunity.title}`" @click="remove">{{ saving ? 'Deleting…' : 'Delete' }}</button>
    <span v-if="error" class="admin-error" role="alert">{{ error }}</span>
  </span>
</template>

<style scoped>
.delete-control { display: inline-flex; flex-wrap: wrap; gap: 10px; align-items: center; }
</style>
