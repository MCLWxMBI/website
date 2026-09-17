<script setup lang="ts">
import { jurisdictions, opportunityCategories, opportunityStatuses } from '~/types/opportunity'
import type { Jurisdiction, OpportunityCategory, OpportunityStatus } from '~/types/opportunity'
import type { OpportunityAccess } from '~/utils/opportunity-access'

const props = defineProps<{
  selectedJurisdictions: Jurisdiction[]
  selectedCategories: OpportunityCategory[]
  selectedStatuses: OpportunityStatus[]
  selectedAccess: OpportunityAccess[]
}>()

const emit = defineEmits<{
  toggleJurisdiction: [value: Jurisdiction]
  toggleCategory: [value: OpportunityCategory]
  toggleStatus: [value: OpportunityStatus]
  toggleAccess: [value: OpportunityAccess]
  clear: []
}>()

const statusLabels: Record<OpportunityStatus, string> = { open: 'Open now', upcoming: 'Upcoming', closed: 'Closed' }
const accessLabels: Record<OpportunityAccess, string> = { public: 'Public', 'invite-only': 'Invite-only' }
const accessValues: OpportunityAccess[] = ['public', 'invite-only']
const hasFilters = computed(() => props.selectedJurisdictions.length + props.selectedCategories.length + props.selectedStatuses.length > 0
  || props.selectedAccess.length !== accessValues.length)
</script>

<template>
  <div class="filters">
    <div class="filter-heading">
      <h2>Filter opportunities</h2>
      <button
        type="button"
        class="text-button"
        :class="{ 'is-hidden': !hasFilters }"
        :disabled="!hasFilters"
        :aria-hidden="hasFilters ? undefined : 'true'"
        @click="emit('clear')"
      >Clear all</button>
    </div>
    <fieldset>
      <legend>Location</legend>
      <label v-for="item in jurisdictions" :key="item" class="check-row">
        <input type="checkbox" :checked="selectedJurisdictions.includes(item)" @change="emit('toggleJurisdiction', item)">
        <span>{{ item }}</span>
      </label>
    </fieldset>
    <fieldset>
      <legend>Category</legend>
      <label v-for="item in opportunityCategories" :key="item" class="check-row">
        <input type="checkbox" :checked="selectedCategories.includes(item)" @change="emit('toggleCategory', item)">
        <span>{{ item }}</span>
      </label>
    </fieldset>
    <fieldset>
      <legend>Status</legend>
      <label v-for="item in opportunityStatuses" :key="item" class="check-row">
        <input type="checkbox" :checked="selectedStatuses.includes(item)" @change="emit('toggleStatus', item)">
        <span>{{ statusLabels[item] }}</span>
      </label>
    </fieldset>
    <fieldset>
      <legend>Access</legend>
      <label v-for="item in accessValues" :key="item" class="check-row">
        <input type="checkbox" :checked="selectedAccess.includes(item)" @change="emit('toggleAccess', item)">
        <span>{{ accessLabels[item] }}</span>
      </label>
    </fieldset>
  </div>
</template>
