<script setup lang="ts">
import type { AdminOpportunitySource } from '~~/shared/types/admin-opportunity'
const name = defineModel<string>({ required: true })
const sourceId = defineModel<string>('sourceId', { required: true })
const props = defineProps<{ sources: AdminOpportunitySource[]; invalid?: boolean }>()
const open = ref(false)
const highlighted = ref(-1)
const matches = computed(() => props.sources.filter(source => source.name.toLocaleLowerCase().includes(name.value.trim().toLocaleLowerCase())))
const expanded = computed(() => open.value && matches.value.length > 0)
watch(matches, () => { highlighted.value = -1 })
function typeName(event: Event) {
  name.value = (event.target as HTMLInputElement).value
  sourceId.value = ''
  highlighted.value = -1
  open.value = true
}
function choose(source: AdminOpportunitySource) {
  name.value = source.name
  sourceId.value = source.id
  open.value = false
  highlighted.value = -1
}
function keydown(event: KeyboardEvent) {
  if (event.key === 'Escape') { open.value = false; highlighted.value = -1; return }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    if (!matches.value.length) return
    event.preventDefault()
    open.value = true
    highlighted.value = highlighted.value < 0
      ? (event.key === 'ArrowDown' ? 0 : matches.value.length - 1)
      : (highlighted.value + (event.key === 'ArrowDown' ? 1 : -1) + matches.value.length) % matches.value.length
    nextTick(() => document.getElementById(`organisation-option-${highlighted.value}`)?.scrollIntoView({ block: 'nearest' }))
  } else if (event.key === 'Enter' && expanded.value && highlighted.value >= 0) {
    event.preventDefault()
    choose(matches.value[highlighted.value]!)
  }
}
</script>

<template>
  <div class="organisation-autocomplete">
    <label for="opportunity-org">Publishing organisation <span>(required)</span></label>
    <input id="opportunity-org" :value="name" type="text" maxlength="255" required autocomplete="off" role="combobox"
      aria-autocomplete="list" aria-controls="organisation-suggestions" :aria-expanded="expanded"
      :aria-activedescendant="expanded && highlighted >= 0 ? `organisation-option-${highlighted}` : undefined"
      :aria-invalid="invalid || undefined" aria-describedby="organisation-help"
      @input="typeName" @focus="open = true" @blur="open = false" @keydown="keydown">
    <ul v-if="expanded" id="organisation-suggestions" role="listbox" aria-label="Existing organisations">
      <li v-for="(source, index) in matches" :id="`organisation-option-${index}`" :key="source.id" role="option"
        :aria-selected="source.id === sourceId" :class="{ highlighted: index === highlighted }"
        @pointerdown.prevent @click="choose(source)">
        <strong>{{ source.name }}</strong><span>{{ source.indexUrl }}</span>
        <small v-if="!source.active">Scraping disabled</small>
      </li>
    </ul>
    <p id="organisation-help">Choose an existing source or type a new organisation name.</p>
  </div>
</template>

<style scoped>
.organisation-autocomplete { position: relative; }
label { display: block; font-weight: 700; margin: 16px 0 8px; }
label span { font-weight: 400; }
input { width: 100%; min-width: 0; padding: 12px; border: 1px solid var(--line); border-radius: 6px; font: inherit; }
input[aria-invalid=true] { border-color: #a32727; }
ul { position: absolute; z-index: 10; left: 0; right: 0; max-height: 300px; overflow: auto; padding: 0; margin: 0; list-style: none; border: 1px solid var(--line); background: white; color: #222; box-shadow: 0 4px 12px #0002; }
li { padding: 12px; cursor: pointer; overflow-wrap: anywhere; }
li + li { border-top: 1px solid var(--line); }
li:hover, li.highlighted { background: #edf5f1; }
li span, li small { display: block; }
</style>
