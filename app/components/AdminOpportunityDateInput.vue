<script setup lang="ts">
import { melbourneTimeChoices, melbourneTimeZoneName } from '~~/shared/utils/melbourne-time'
const props = defineProps<{ id: string; label: string; required?: boolean; invalid?: boolean }>()
const date = defineModel<string>('date', { required: true })
const time = defineModel<string>('time', { required: true })
const occurrence = defineModel<string>('occurrence', { required: true })
const choices = computed(() => {
  try { return date.value ? melbourneTimeChoices(date.value, time.value) : [] } catch { return [] }
})
watch([date, time], () => { occurrence.value = '' })
</script>

<template>
  <div class="date-input">
    <label :for="id">{{ label }} date ({{ required ? 'required' : 'optional' }})</label>
    <input :id="id" v-model="date" type="date" min="0001-01-01" max="9999-12-31" :required="required" :aria-invalid="invalid">
    <label :for="`${id}-time`">{{ label }} time (Melbourne, optional)</label>
    <input :id="`${id}-time`" v-model="time" type="time" step="0.001" :aria-invalid="invalid" :aria-describedby="`${id}-help`">
    <p :id="`${id}-help`">If time is blank, midnight at the start of this date is used. Daylight saving is handled automatically.</p>
    <template v-if="choices.length > 1">
      <label :for="`${id}-occurrence`">{{ label }} time occurrence (required)</label>
      <select :id="`${id}-occurrence`" v-model="occurrence" required :aria-invalid="invalid">
        <option value="" disabled>Choose which occurrence</option>
        <option v-for="(choice, index) in choices" :key="choice.utc" :value="choice.utc">{{ index === 0 ? 'First occurrence' : 'Second occurrence' }} ({{ melbourneTimeZoneName(choice.utc) }})</option>
      </select>
      <p>This time occurs twice when clocks go back. Select the occurrence intended by the publisher.</p>
    </template>
  </div>
</template>

<style scoped>
.date-input label { display: block; font-weight: 700; margin: 16px 0 8px; }
.date-input input, .date-input select { width: 100%; min-width: 0; padding: 12px; border: 1px solid var(--line); border-radius: 6px; font: inherit; }
.date-input [aria-invalid=true] { border-color: #a32727; }
</style>
