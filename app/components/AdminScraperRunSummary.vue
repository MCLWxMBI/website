<script setup lang="ts">
import type { ScraperRunSummary } from '~~/shared/types/admin-scraper-runs'
import { formatScraperRunTime, scraperRunDuration } from '~/utils/scraper-runs'
defineProps<{ run: ScraperRunSummary; now: number }>()
</script>

<template>
  <dl class="run-summary">
    <div><dt>Status</dt><dd><span class="run-status" :class="run.status">{{ run.status }}</span></dd></div>
    <div><dt>Started (Melbourne)</dt><dd><time :datetime="run.startedAt">{{ formatScraperRunTime(run.startedAt) }}</time></dd></div>
    <div><dt>Finished (Melbourne)</dt><dd><time v-if="run.finishedAt" :datetime="run.finishedAt">{{ formatScraperRunTime(run.finishedAt) }}</time><span v-else>{{ run.status === 'running' ? 'Not finished' : 'Not recorded' }}</span></dd></div>
    <div><dt>{{ run.finishedAt ? 'Duration' : 'Elapsed' }}</dt><dd><ClientOnly v-if="run.status === 'running' && !run.finishedAt" fallback="Elapsed time since start">{{ scraperRunDuration(run, now) }}</ClientOnly><template v-else>{{ scraperRunDuration(run, now) }}</template></dd></div>
    <div><dt>Sources reported</dt><dd>{{ run.sourceCount }}</dd></div>
    <div><dt>Discovered</dt><dd>{{ run.totals.discoveredCount }}</dd></div>
    <div><dt>Processed</dt><dd>{{ run.totals.processedCount }}</dd></div>
    <div><dt>Passed</dt><dd>{{ run.totals.passedCount }}</dd></div>
    <div><dt>Invalid</dt><dd>{{ run.totals.invalidCount }}</dd></div>
    <div><dt>Failed articles</dt><dd>{{ run.totals.failedCount }}</dd></div>
    <div><dt>Skipped</dt><dd>{{ run.totals.skippedCount }}</dd></div>
  </dl>
</template>
