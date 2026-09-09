<script setup lang="ts">
import type { StaticPageResponse, StaticPageSlug } from '~~/shared/types/static-page'
import type { PageSectionNavItem } from '~/types/page-section-nav'
import { extractPageNavigation } from '~/utils/page-navigation'

const props = defineProps<{
  slug: StaticPageSlug
  contentClass: string
  emptyTitle: string
}>()

const article = ref<HTMLElement | null>(null)
const navigation = ref<PageSectionNavItem[]>([])
const { data, error } = await useFetch<StaticPageResponse>(() => `/api/pages/${props.slug}`, {
  key: `static-page-${props.slug}`
})

if (error.value) {
  throw createError({
    statusCode: error.value.statusCode ?? 503,
    statusMessage: 'Page content is temporarily unavailable. Please try again.'
  })
}

async function rebuildNavigation() {
  if (!import.meta.client) return
  await nextTick()
  navigation.value = article.value ? extractPageNavigation(article.value) : []
}

onMounted(rebuildNavigation)
watch(() => data.value?.contentHtml, rebuildNavigation)
</script>

<template>
  <div class="info-page">
    <div class="container info-layout">
      <PageSectionNav v-if="navigation.length" :items="navigation" />

      <article ref="article" class="info-content" :class="contentClass">
        <!-- HTML is sanitized by the public content endpoint. -->
        <div v-if="data?.exists" class="static-page-fragment" v-html="data.contentHtml" />
        <div v-else class="static-page-empty" role="status">
          <h1>{{ emptyTitle }}</h1>
          <p>This page’s content is being prepared. Please check back soon.</p>
        </div>
      </article>
    </div>
  </div>
</template>
