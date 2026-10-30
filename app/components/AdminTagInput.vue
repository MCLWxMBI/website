<script setup lang="ts">
import { normalizeOpportunityLabels } from '~~/shared/utils/admin-opportunity'
const props = defineProps<{ modelValue: string[]; label: string; disabled?: boolean; inviteToggle?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [string[]]; inviteOnly: [] }>()
const entry = ref('')
const message = ref('')
const inputId = useId()
function add() {
  if (props.disabled) return
  try {
    const [label] = normalizeOpportunityLabels([entry.value], 'tags')
    if (props.inviteToggle && label!.toLowerCase() === 'invite-only') {
      emit('inviteOnly')
      message.value = 'Invite-only has been enabled using its toggle.'
    } else {
      emit('update:modelValue', normalizeOpportunityLabels([...props.modelValue, label!], 'tags'))
      message.value = ''
    }
    entry.value = ''
  } catch { message.value = 'Enter a non-empty plain-text label.' }
}
</script>

<template>
  <div class="admin-tag-input">
    <label :for="inputId">{{ label }}</label>
    <div class="tag-entry">
      <input :id="inputId" v-model="entry" type="text" :disabled="disabled" @keydown.enter.prevent="add">
      <button type="button" class="button button-secondary" :disabled="disabled" @click="add">Add {{ label.toLowerCase() }}</button>
    </div>
    <p v-if="message" role="status">{{ message }}</p>
    <ul v-if="modelValue.length" class="tag-values" :aria-label="`${label} selected`">
      <li v-for="(tag, index) in modelValue" :key="tag">
        <span>{{ tag }}</span>
        <button type="button" :disabled="disabled" :aria-label="`Remove ${tag}`" @click="emit('update:modelValue', modelValue.filter((_, i) => i !== index))">×</button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.admin-tag-input { margin-block: 16px; }
label { display: block; font-weight: 700; margin-bottom: 8px; }
.tag-entry { display: flex; flex-wrap: wrap; gap: 10px; }
input { flex: 1 1 180px; min-width: 0; padding: 12px; font: inherit; border: 1px solid var(--line); border-radius: 6px; }
.tag-values { display: flex; flex-wrap: wrap; gap: 8px; list-style: none; padding: 0; }
.tag-values li { display: flex; align-items: center; gap: 8px; background: var(--green-100, #edf3ef); border-radius: 6px; padding: 6px 10px; }
.tag-values button { border: 0; background: transparent; font: inherit; font-size: 1.3em; cursor: pointer; }
</style>
