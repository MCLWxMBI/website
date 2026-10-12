<script setup lang="ts">
import { jurisdictions, opportunityCategories, opportunityStatuses } from '~/types/opportunity'
import type { Jurisdiction, OpportunityCategory, OpportunityStatus } from '~/types/opportunity'
import type { OpportunityAccess } from '~/utils/opportunity-access'
import { searchOpportunityAuthorities } from '~/utils/opportunity-authority'

const authoritySearch = ref('')
const props = defineProps<{
  authorities: string[]
  selectedAuthorities: string[]
  selectedJurisdictions: Jurisdiction[]
  selectedCategories: OpportunityCategory[]
  selectedStatuses: OpportunityStatus[]
  selectedAccess: OpportunityAccess[]
}>()

const emit = defineEmits<{
  toggleAuthority: [value: string]
  toggleJurisdiction: [value: Jurisdiction]
  toggleCategory: [value: OpportunityCategory]
  toggleStatus: [value: OpportunityStatus]
  toggleAccess: [value: OpportunityAccess]
  clear: []
}>()

const visibleAuthorities = computed(() => searchOpportunityAuthorities(props.authorities, authoritySearch.value))
const clear = () => { authoritySearch.value = ''; emit('clear') }

const statusLabels: Record<OpportunityStatus, string> = { open: 'Open now', upcoming: 'Upcoming', closed: 'Closed' }
const accessLabels: Record<OpportunityAccess, string> = { public: 'Public', 'invite-only': 'Invite-only' }
const accessValues: OpportunityAccess[] = ['public', 'invite-only']
const hasFilters = computed(() => props.selectedAuthorities.length + props.selectedJurisdictions.length + props.selectedCategories.length + props.selectedStatuses.length > 0
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
        @click="clear"
      >Clear all</button>
    </div>
    <fieldset>
      <legend>Location</legend>
      <label v-for="item in jurisdictions" :key="item" class="check-row">
        <input type="checkbox" :checked="selectedJurisdictions.includes(item)" @change="emit('toggleJurisdiction', item)">
        <span>{{ item }}</span>
      </label>
    </fieldset>
    <fieldset class="authority-filter">
      <legend>Authority</legend>
      <ul v-if="selectedAuthorities.length" class="selected-authorities" aria-label="Selected authorities">
        <li v-for="authority in selectedAuthorities" :key="authority">
          <button type="button" :aria-label="`Remove ${authority}`" @click="emit('toggleAuthority', authority)">
            <span>{{ authority }}</span><span aria-hidden="true">×</span>
          </button>
        </li>
      </ul>
      <label class="authority-search">
        <span>Search authorities</span>
        <input v-model="authoritySearch" type="search" placeholder="Search organisation names">
      </label>
      <div class="authority-options">
        <label v-for="authority in visibleAuthorities" :key="authority" class="check-row">
          <input type="checkbox" :checked="selectedAuthorities.includes(authority)" @change="emit('toggleAuthority', authority)">
          <span>{{ authority }}</span>
        </label>
        <p v-if="!visibleAuthorities.length" role="status">No matching authorities</p>
      </div>
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
