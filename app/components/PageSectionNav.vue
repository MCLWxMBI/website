<script setup lang="ts">
import type { PageSectionNavItem } from '~/types/page-section-nav'

defineProps<{
  items: PageSectionNavItem[]
}>()
</script>

<template>
  <nav class="section-index" aria-label="On this page">
    <p>On this page</p>
    <ul>
      <li v-for="item in items" :key="item.href">
        <a :href="item.href">{{ item.label }}</a>
        <ul v-if="item.children?.length">
          <li v-for="child in item.children" :key="child.href">
            <a :href="child.href">{{ child.label }}</a>
          </li>
        </ul>
      </li>
    </ul>
  </nav>
</template>
