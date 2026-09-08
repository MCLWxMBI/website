<script setup lang="ts">
import type { StaticPageResponse, StaticPageSlug, StoredStaticPageResponse } from '~~/shared/types/static-page'
import { isStaticPageSlug } from '~~/shared/types/static-page'
import { sanitizeStaticPageHtml } from '~~/shared/utils/static-page-content'
import { staticPageDetails, staticPageTemplates } from '~/content/static-pages'
import { listEditablePageHeadings, updateEditablePageHeading } from '~/utils/page-navigation'
import { getStaticPageEditorState, resolveEditorReadyContent } from '~/utils/static-page-editor-state'

definePageMeta({ layout: 'admin', middleware: 'admin' })
useSeoMeta({ title: 'Edit static page' })

const route = useRoute()
const slugValue = Array.isArray(route.params.slug) ? route.params.slug[0] : route.params.slug
if (!isStaticPageSlug(slugValue)) throw createError({ statusCode: 404, statusMessage: 'Page not found.' })
const slug: StaticPageSlug = slugValue
const details = staticPageDetails[slug]
const { $csrfFetch } = useNuxtApp()
const { data, error: loadRequestError } = await useFetch<StaticPageResponse>(`/api/admin/pages/${slug}`)
if (loadRequestError.value) throw createError({ statusCode: loadRequestError.value.statusCode ?? 503, statusMessage: 'Page content is temporarily unavailable.' })

const initialHtml = data.value?.contentHtml ?? staticPageTemplates[slug]
const published = ref(data.value?.exists === true)
const baselineHtml = ref(initialHtml)
const contentHtml = ref(initialHtml)
const savedAt = ref(data.value?.updatedAt ?? null)
const saving = ref(false)
const clientReady = ref(false)
const editorReady = ref(false)
const changedBeforeEditorReady = ref(false)
const feedback = ref('')
const error = ref('')
const selectedBlock = ref(slug === 'about' ? 'about-body' : 'content-section')
const imageUrl = ref('')
const imageAlt = ref('')
const editor = ref<{ insertHtml: (html: string) => void } | null>(null)
const editorState = computed(() => getStaticPageEditorState(published.value, contentHtml.value, baselineHtml.value))
const dirty = computed(() => editorState.value.dirty)
const canSave = computed(() => editorState.value.canSave)
const previewHtml = computed(() => sanitizeStaticPageHtml(contentHtml.value))
const savedAtLabel = computed(() => savedAt.value ? new Date(savedAt.value).toISOString().replace('T', ' ').replace('Z', ' UTC') : '')
const headings = computed(() => {
  if (!clientReady.value) return []
  const document = new DOMParser().parseFromString(contentHtml.value, 'text/html')
  return listEditablePageHeadings(document.body)
})

const blocks = computed(() => slug === 'about' ? [
  { value: 'about-body', label: 'About body', html: '<div class="about-body"><p>Write the About content here.</p></div>' },
  { value: 'acknowledgement', label: 'Acknowledgment', html: '<p class="about-acknowledgement"><em>Acknowledgment text.</em></p>' },
  { value: 'faq-group', label: 'FAQ group', html: '<section class="about-faq"><h2>FAQ</h2></section>' },
  { value: 'faq-section', label: 'FAQ subsection', html: '<section class="faq-section"><h3>Question</h3><p>Answer.</p></section>' },
  { value: 'faq-entry', label: 'FAQ entry', html: '<div class="faq-entry"><h4>Entry heading</h4><p>Entry text.</p></div>' },
  { value: 'faq-list', label: 'FAQ numbered list', html: '<ol class="faq-numbered-list"><li><h4>List heading</h4><p>List text.</p></li></ol>' },
  { value: 'roman-list', label: 'Roman-numeral list', html: '<ol type="I"><li>List item</li></ol>' },
  { value: 'disclaimer', label: 'Disclaimer', html: '<footer class="about-disclaimer"><p>Disclaimer text.</p></footer>' }
] : [
  { value: 'content-section', label: 'Content section', html: '<section class="resource-section"><h2>Section heading</h2><p>Write your section here.</p></section>' },
  { value: 'intro', label: 'Introductory header', html: '<header class="resource-intro"><p class="section-kicker">Section label</p><h1>Page title</h1><p>Introduction.</p></header>' },
  { value: 'encouragement', label: 'Encouragement', html: '<p class="resource-encouragement">Encouragement text.</p>' },
  { value: 'prompt', label: 'Prompt', html: '<p class="resource-prompt">Prompt text.</p>' },
  { value: 'numbered-steps', label: 'Numbered steps', html: '<ol class="resource-steps"><li><h3>Step heading</h3><p>Step text.</p></li></ol>' },
  { value: 'comparison-list', label: 'Comparison list', html: '<ol class="comparison-list"><li>Comparison item</li></ol>' },
  { value: 'checklist', label: 'Checklist', html: '<ul class="participation-checklist"><li>Checklist item</li></ul>' },
  { value: 'callout', label: 'Green callout', html: '<div class="resource-callout"><h3>Callout heading</h3><p>Callout text.</p></div>' },
  { value: 'readings', label: 'Reading links', html: '<ul class="resource-list"><li><a href="https://example.com" target="_blank" rel="noopener noreferrer"><span>Reading title</span><span aria-hidden="true">↗</span><span class="sr-only"> (opens in a new tab)</span></a></li></ul>' },
  { value: 'attribution', label: 'Attribution', html: '<p class="resource-attribution"><em>Attribution text.</em></p>' }
])

function updateHeading(index: number, update: { included?: boolean, label?: string, parentId?: string }) {
  contentHtml.value = updateEditablePageHeading(contentHtml.value, index, update)
  if (!editorReady.value) changedBeforeEditorReady.value = true
}

function parentOptions(index: number) {
  return headings.value.filter(heading => heading.index < index && heading.included && !heading.parentId)
}

function changeHeadingIncluded(event: Event, index: number) {
  updateHeading(index, { included: (event.target as HTMLInputElement).checked })
}

function changeHeadingLabel(event: Event, index: number) {
  updateHeading(index, { label: (event.target as HTMLInputElement).value })
}

function changeHeadingParent(event: Event, index: number) {
  updateHeading(index, { parentId: (event.target as HTMLSelectElement).value })
}

function insertSelectedBlock() {
  const block = blocks.value.find(item => item.value === selectedBlock.value)
  if (block) editor.value?.insertHtml(block.html)
}

function escapeAttribute(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function insertImage() {
  const validUrl = imageUrl.value.startsWith('/') || /^https:\/\//i.test(imageUrl.value)
  if (!validUrl || !imageAlt.value.trim()) {
    error.value = 'Enter an HTTPS or same-site image URL and descriptive alternative text.'
    return
  }
  editor.value?.insertHtml(`<figure><img src="${escapeAttribute(imageUrl.value)}" alt="${escapeAttribute(imageAlt.value.trim())}"><figcaption>Image caption</figcaption></figure>`)
  imageUrl.value = ''
  imageAlt.value = ''
  error.value = ''
}

function reloadTemplate() {
  if (dirty.value && !window.confirm('Discard your unsaved changes and reload the original template?')) return
  contentHtml.value = staticPageTemplates[slug]
  if (!published.value) baselineHtml.value = staticPageTemplates[slug]
  if (!editorReady.value) changedBeforeEditorReady.value = published.value
  feedback.value = 'Original template loaded in the editor. Save to publish it.'
  error.value = ''
}

function updateEditorContent(value: string) {
  contentHtml.value = value
}

function editorLoaded(normalizedHtml: string) {
  const readyContent = resolveEditorReadyContent(
    contentHtml.value,
    baselineHtml.value,
    normalizedHtml,
    changedBeforeEditorReady.value
  )
  contentHtml.value = readyContent.contentHtml
  baselineHtml.value = readyContent.baselineHtml
  editorReady.value = true
}

async function save() {
  if (saving.value) return
  saving.value = true
  feedback.value = ''
  error.value = ''
  try {
    const result = await $csrfFetch<StoredStaticPageResponse>(`/api/admin/pages/${slug}`, {
      method: 'PUT',
      body: { contentHtml: contentHtml.value }
    })
    contentHtml.value = result.contentHtml
    baselineHtml.value = result.contentHtml
    published.value = true
    savedAt.value = result.updatedAt
    feedback.value = 'Page saved and published.'
  } catch (cause) {
    const status = cause && typeof cause === 'object' && 'statusCode' in cause ? cause.statusCode : undefined
    error.value = status === 403
      ? 'Your security token could not be verified. Reload this page before trying again.'
      : status === 400 ? 'The page could not be saved. Check that it has a title and content.'
        : 'The page could not be saved. Your previously published content is unchanged.'
  } finally {
    saving.value = false
  }
}

function beforeUnload(event: BeforeUnloadEvent) {
  if (!dirty.value) return
  event.preventDefault()
  event.returnValue = ''
}

onMounted(() => {
  clientReady.value = true
  window.addEventListener('beforeunload', beforeUnload)
})
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
onBeforeRouteLeave(() => !dirty.value || window.confirm('Leave without saving your changes?'))
</script>

<template>
  <section aria-labelledby="editor-title">
    <NuxtLink to="/admin?tab=pages" class="admin-back-link">← Back to pages</NuxtLink>
    <div class="admin-editor-heading">
      <div>
        <p class="admin-eyebrow">Static page editor</p>
        <h1 id="editor-title">Edit {{ details.title }}</h1>
        <p class="admin-intro">Changes become public as soon as you save.</p>
      </div>
      <div class="admin-editor-actions">
        <NuxtLink :to="details.publicPath" target="_blank" rel="noopener">View public page<span class="sr-only"> (opens in a new tab)</span></NuxtLink>
        <button type="button" class="button admin-secondary-button" @click="reloadTemplate">Reload original template</button>
        <button type="button" class="button button-primary" :disabled="saving || !canSave" @click="save">{{ saving ? 'Saving…' : 'Save and publish' }}</button>
      </div>
    </div>

    <p class="admin-save-state" aria-live="polite">
      {{ dirty ? 'Unsaved changes' : published && savedAt ? `Saved ${savedAtLabel}` : 'Not published' }}
    </p>
    <p v-if="feedback" class="admin-success" role="status">{{ feedback }}</p>
    <p v-if="error" class="admin-error" role="alert">{{ error }}</p>

    <div class="admin-editor-tools admin-card">
      <div>
        <label for="block-type">Insert a styled block</label>
        <p class="admin-control-help">Place the cursor in the editor where the new block should appear.</p>
        <div class="admin-inline-controls">
          <select id="block-type" v-model="selectedBlock">
            <option v-for="block in blocks" :key="block.value" :value="block.value">{{ block.label }}</option>
          </select>
          <button type="button" class="button admin-secondary-button" :disabled="!editorReady" @click="insertSelectedBlock">Insert block</button>
        </div>
      </div>
      <details>
        <summary>Insert an image from a link</summary>
        <div class="admin-image-controls">
          <label for="image-url">HTTPS or same-site image URL</label>
          <input id="image-url" v-model="imageUrl" type="url" placeholder="https://example.org/image.jpg">
          <label for="image-alt">Alternative text</label>
          <input id="image-alt" v-model="imageAlt" type="text">
          <button type="button" class="button admin-secondary-button" :disabled="!editorReady" @click="insertImage">Insert image</button>
        </div>
      </details>
    </div>

    <div class="admin-editor-layout">
      <div class="admin-editor-column">
        <h2>Editor</h2>
        <JoditEditor ref="editor" :model-value="contentHtml" :content-class="details.contentClass" @update:model-value="updateEditorContent" @ready="editorLoaded" />
      </div>

      <aside class="admin-nav-editor admin-card" aria-labelledby="nav-editor-title">
        <h2 id="nav-editor-title">On this page</h2>
        <p>Choose the headings that should appear in the public page navigation.</p>
        <ol v-if="headings.length">
          <li v-for="heading in headings" :key="heading.index">
            <label class="admin-nav-toggle">
              <input type="checkbox" :checked="heading.included" @change="changeHeadingIncluded($event, heading.index)">
              <span>{{ heading.text || 'Untitled heading' }}</span>
            </label>
            <template v-if="heading.included">
              <label :for="`nav-label-${heading.index}`">Short label</label>
              <input :id="`nav-label-${heading.index}`" :value="heading.label" @change="changeHeadingLabel($event, heading.index)">
              <label :for="`nav-parent-${heading.index}`">Nesting</label>
              <select :id="`nav-parent-${heading.index}`" :value="heading.parentId" @change="changeHeadingParent($event, heading.index)">
                <option value="">Top level</option>
                <option v-for="parent in parentOptions(heading.index)" :key="parent.id" :value="parent.id">Under {{ parent.label }}</option>
              </select>
            </template>
          </li>
        </ol>
      </aside>
    </div>

    <section class="admin-preview" aria-labelledby="preview-title">
      <h2 id="preview-title">Public preview</h2>
      <article class="info-content" :class="details.contentClass">
        <div class="static-page-fragment" v-html="previewHtml" />
      </article>
    </section>
  </section>
</template>
