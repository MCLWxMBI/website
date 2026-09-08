<script setup lang="ts">
import { Jodit } from 'jodit'
import { applyEditorReadOnly } from '~/utils/static-page-editor-state'

const props = defineProps<{
  modelValue: string
  contentClass: string
  readOnly: boolean
}>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
  ready: [value: string]
}>()

const host = ref<HTMLElement | null>(null)
const loadError = ref('')
let editor: Jodit | undefined

const stylesheet = {
  id: 'jodit-4-14-4-styles',
  href: 'https://cdn.jsdelivr.net/npm/jodit@4.14.4/es2021/jodit.min.css',
  integrity: 'sha384-OsXMwqKqybg+wjNCU5dYOCwHoTDRXI+G/oyhR5lyl75ruH4kUsNtZzbmfU4MpguM'
}

function loadStylesheet(): Promise<void> {
  const existing = document.getElementById(stylesheet.id) as HTMLLinkElement | null
  if (existing?.dataset.loaded === 'true') return Promise.resolve()
  return new Promise((resolve, reject) => {
    const link = existing ?? document.createElement('link')
    const loaded = () => {
      link.dataset.loaded = 'true'
      resolve()
    }
    link.addEventListener('load', loaded, { once: true })
    link.addEventListener('error', () => reject(new Error('Unable to load editor styles.')), { once: true })
    if (!existing) {
      link.id = stylesheet.id
      link.rel = 'stylesheet'
      link.href = stylesheet.href
      link.integrity = stylesheet.integrity
      link.crossOrigin = 'anonymous'
      document.head.append(link)
    }
  })
}

async function start() {
  loadError.value = ''
  try {
    await loadStylesheet()
    if (!host.value || editor) return
    editor = Jodit.make(host.value, {
      height: 620,
      readonly: props.readOnly,
      toolbarAdaptive: false,
      buttons: ['undo', 'redo', '|', 'paragraph', 'bold', 'italic', '|', 'ul', 'ol', 'blockquote', '|', 'link', 'eraser'],
      askBeforePasteHTML: false,
      askBeforePasteFromWord: false,
      uploader: { insertImageAsBase64URI: false }
    })
    editor.value = props.modelValue
    applyEditorReadOnly(editor, props.readOnly)
    editor.editor.classList.add('static-page-editor-canvas', 'info-content', props.contentClass)
    editor.events.on('change', () => {
      if (!props.readOnly) emit('update:modelValue', editor?.value ?? '')
    })
    emit('ready', editor.value)
  } catch {
    document.getElementById(stylesheet.id)?.remove()
    loadError.value = 'The editor styles could not be loaded. Check your connection and try again.'
  }
}

function insertHtml(html: string) {
  if (!editor || props.readOnly) return
  editor.s.insertHTML(html)
  emit('update:modelValue', editor.value)
  editor.synchronizeValues()
  editor.editor.focus()
}

watch(() => props.modelValue, (value) => {
  if (editor && editor.value !== value) editor.value = value
})

watch(() => props.readOnly, value => applyEditorReadOnly(editor, value))

onMounted(start)
onBeforeUnmount(() => {
  editor?.destruct()
  editor = undefined
})

defineExpose({ insertHtml })
</script>

<template>
  <div>
    <div v-if="loadError" class="admin-editor-load-error" role="alert">
      <p>{{ loadError }}</p>
      <button type="button" class="button admin-secondary-button" @click="start">Retry loading editor</button>
    </div>
    <div v-show="!loadError" ref="host" />
  </div>
</template>
