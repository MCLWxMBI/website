<script setup lang="ts">
import type { OpportunityStatus } from '~/types/opportunity'

const props = defineProps<{ status: OpportunityStatus }>()
const labels: Record<OpportunityStatus, string> = {
  open: 'Open now',
  upcoming: 'Upcoming',
  closed: 'Closed'
}
</script>

<template>
  <span class="status-badge" :class="status">{{ labels[props.status] }}</span>
</template>
