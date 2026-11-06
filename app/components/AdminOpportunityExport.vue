<script setup lang="ts">
const exporting = ref(false)
const error = ref('')

async function exportAll() {
  if (exporting.value) return
  exporting.value = true
  error.value = ''
  let url: string | undefined
  try {
    const response = await $fetch.raw<Blob>('/api/admin/opportunities/export', { responseType: 'blob' })
    if (!response._data) throw new Error('Missing workbook')
    const filename = response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1]
      ?? 'echo-opportunities.xlsx'
    url = URL.createObjectURL(response._data)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.append(link)
    link.click()
    link.remove()
    // Give the browser time to start reading the object URL before releasing it.
    const downloadUrl = url
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000)
    url = undefined
  } catch {
    error.value = 'Could not export opportunities. Please try again.'
  } finally {
    if (url) URL.revokeObjectURL(url)
    exporting.value = false
  }
}
</script>

<template>
  <div class="opportunity-export">
    <button type="button" class="button button-primary" :disabled="exporting" :aria-busy="exporting" @click="exportAll">
      {{ exporting ? 'Exporting…' : 'Export all opportunities' }}
    </button>
    <p v-if="error" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped>
.opportunity-export { text-align: right; }
.opportunity-export p { color: var(--color-danger, #a12622); margin: .5rem 0 0; }
@media (max-width: 600px) { .opportunity-export { text-align: left; } }
</style>
