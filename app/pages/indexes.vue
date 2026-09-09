<script setup lang="ts">
import type { WebsiteIndexesResponse } from '~~/shared/types/website-index'
import { getWebsiteIndexesViewState, getWebsiteIndexStatus } from '~~/shared/utils/website-index'

useSeoMeta({
  title: 'Website indexes',
  description: 'See the public consultation websites included in ECHO and their current indexing status.'
})

const { data, error, status, refresh } = await useFetch<WebsiteIndexesResponse>('/api/indexes', {
  default: () => []
})

const viewState = computed(() => getWebsiteIndexesViewState(data.value, Boolean(error.value)))
const checking = computed(() => status.value === 'pending')
</script>

<template>
  <div class="indexes-page">
    <div class="container indexes-content">
      <header class="indexes-heading">
        <p class="section-kicker">Source coverage</p>
        <h1>Website indexes</h1>
        <p>ECHO checks these public websites for environmental consultation opportunities. Their current indexing status is shown below.</p>
      </header>

      <section
        v-if="viewState === 'maintenance'"
        class="indexes-maintenance"
        role="status"
        aria-live="polite"
      >
        <span class="indexes-maintenance-icon" aria-hidden="true">&#9881;</span>
        <h2>Table under maintenance</h2>
        <p>Website index statuses are temporarily unavailable. Please check again shortly.</p>
        <button class="button button-primary" type="button" :disabled="checking" @click="refresh()">
          {{ checking ? 'Checking…' : 'Try again' }}
        </button>
      </section>

      <div
        v-else
        class="indexes-table-region"
        role="region"
        aria-labelledby="indexes-table-caption"
        tabindex="0"
      >
        <table class="indexes-table">
          <caption id="indexes-table-caption">Current website indexing status</caption>
          <thead>
            <tr>
              <th scope="col">Website</th>
              <th scope="col">Index URL</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="index in data" :key="index.id">
              <th scope="row">{{ index.name }}</th>
              <td>
                <a :href="index.indexUrl" target="_blank" rel="noopener noreferrer">
                  {{ index.indexUrl }}
                  <span class="sr-only"> (opens an external website in a new tab)</span>
                </a>
              </td>
              <td>
                <span class="index-status" :class="index.active ? 'active' : 'inactive'">
                  <span aria-hidden="true">{{ getWebsiteIndexStatus(index.active).emoji }}</span>
                  {{ getWebsiteIndexStatus(index.active).label }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
