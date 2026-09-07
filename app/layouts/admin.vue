<script setup lang="ts">
import { logoutAdmin } from '~/utils/admin-logout'
const { user, fetch: refreshSession } = useUserSession()
const { $csrfFetch } = useNuxtApp()
const pending = ref(false)
const error = ref('')
useSeoMeta({ robots: 'noindex, nofollow' })
async function signOut() {
  if (pending.value) return
  pending.value = true
  error.value = ''
  try {
    await logoutAdmin(() => $csrfFetch('/api/_auth/session', { method: 'DELETE' }), refreshSession)
    await navigateTo('/admin/login')
  } catch {
    error.value = 'Unable to sign out. Reload this page and try again.'
  } finally { pending.value = false }
}
</script>

<template>
  <div class="site-shell admin-shell">
    <header class="admin-header">
      <div class="container admin-header-inner">
        <NuxtLink to="/" class="brand"><span><strong>ECHO</strong><small>Administration</small></span></NuxtLink>
        <nav aria-label="Admin navigation" class="admin-actions">
          <NuxtLink to="/">View public site</NuxtLink>
          <span v-if="user">{{ user.username }}</span>
          <button v-if="user" class="button button-primary" :disabled="pending" @click="signOut">{{ pending ? 'Signing out…' : 'Sign out' }}</button>
        </nav>
      </div>
    </header>
    <p v-if="error" class="container admin-error" role="alert">{{ error }}</p>
    <main class="container admin-main"><slot /></main>
  </div>
</template>
