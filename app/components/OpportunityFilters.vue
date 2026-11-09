<script setup lang="ts">
import { jurisdictions, opportunityCategories, opportunityStatuses } from '~/types/opportunity'
import type { Jurisdiction, OpportunityCategory, OpportunityStatus } from '~/types/opportunity'
import type { OpportunityAccess } from '~/utils/opportunity-access'
import { searchOpportunityAuthorities } from '~/utils/opportunity-authority'
import { serializeOpportunityStatuses } from '~/utils/opportunity-status'

const authoritySearch = ref('')
const deadlineId = useId()
const props = defineProps<{
  authorities: string[]
  selectedAuthorities: string[]
  selectedJurisdictions: Jurisdiction[]
  selectedCategories: OpportunityCategory[]
  selectedStatuses: OpportunityStatus[]
  selectedAccess: OpportunityAccess[]
  deadlineFrom: string
  deadlineTo: string
  deadlineError: string | null
}>()

const emit = defineEmits<{
  toggleAuthority: [value: string]
  toggleJurisdiction: [value: Jurisdiction]
  toggleCategory: [value: OpportunityCategory]
  toggleStatus: [value: OpportunityStatus]
  toggleAccess: [value: OpportunityAccess]
  updateDeadline: [bound: 'from' | 'to', value: string, invalid: boolean]
  clear: []
}>()

const visibleAuthorities = computed(() => searchOpportunityAuthorities(props.authorities, authoritySearch.value))
const clear = () => { authoritySearch.value = ''; emit('clear') }

function changeDeadline(bound: 'from' | 'to', event: Event) {
  const input = event.target as HTMLInputElement
  emit('updateDeadline', bound, input.value, !input.validity.valid)
}

const statusLabels: Record<OpportunityStatus, string> = { open: 'Open now', upcoming: 'Upcoming', closed: 'Closed' }
const accessLabels: Record<OpportunityAccess, string> = { public: 'Public', 'invite-only': 'Invite-only' }
const accessValues: OpportunityAccess[] = ['public', 'invite-only']
const hasFilters = computed(() => props.selectedAuthorities.length + props.selectedJurisdictions.length + props.selectedCategories.length > 0
  || serializeOpportunityStatuses(props.selectedStatuses) !== undefined
  || props.selectedAccess.length !== accessValues.length || Boolean(props.deadlineFrom || props.deadlineTo || props.deadlineError))
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
    <fieldset class="deadline-filter">
      <legend>Submission deadline</legend>
      <label :for="`${deadlineId}-from`">From</label>
      <input :id="`${deadlineId}-from`" :value="deadlineFrom" type="date" min="0001-01-01" max="9999-12-31"
        :aria-invalid="Boolean(deadlineError) || undefined" :aria-describedby="`${deadlineId}-help${deadlineError ? ' ' + deadlineId + '-error' : ''}`"
        @change="changeDeadline('from', $event)">
      <label :for="`${deadlineId}-to`">To</label>
      <input :id="`${deadlineId}-to`" :value="deadlineTo" type="date" min="0001-01-01" max="9999-12-31"
        :aria-invalid="Boolean(deadlineError) || undefined" :aria-describedby="`${deadlineId}-help${deadlineError ? ' ' + deadlineId + '-error' : ''}`"
        @change="changeDeadline('to', $event)">
      <p :id="`${deadlineId}-help`" class="deadline-help">Dates use UTC and include both days. Month-only deadlines use the first day of the month.</p>
      <p v-if="deadlineError" :id="`${deadlineId}-error`" class="deadline-error" role="alert">{{ deadlineError }} Results keep the last valid date range.</p>
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
