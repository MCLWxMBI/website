<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })
useSeoMeta({ title: 'Admin login' })
const username = ref('')
const password = ref('')
const pending = ref(false)
const error = ref('')
const { $csrfFetch } = useNuxtApp()
const { fetch: refreshSession } = useUserSession()
async function signIn() {
  if (pending.value) return
  pending.value = true
  error.value = ''
  try {
    await $csrfFetch('/api/admin/login', { method: 'POST', body: { username: username.value, password: password.value } })
    password.value = ''
    await refreshSession()
    await navigateTo('/admin')
  } catch (cause) {
    const status = cause && typeof cause === 'object' && 'statusCode' in cause ? cause.statusCode : undefined
    error.value = status === 403 ? 'Your security token could not be verified. Reload this page and try again.'
      : status === 400 || status === 401 ? 'Invalid username or password.'
      : 'Authentication is temporarily unavailable. Please try again.'
  } finally { pending.value = false }
}
</script>

<template>
  <section class="admin-card admin-login" aria-labelledby="login-title">
    <p class="admin-eyebrow">ECHO Administration</p>
    <h1 id="login-title">Admin login</h1>
    <p>Sign in to access the administration preview.</p>
    <form class="admin-form" :aria-busy="pending" @submit.prevent="signIn">
      <label for="username">Username</label>
      <input id="username" v-model="username" name="username" autocomplete="username" autocapitalize="none" :spellcheck="false" required :aria-describedby="error ? 'login-error' : undefined">
      <label for="password">Password</label>
      <input id="password" v-model="password" name="password" type="password" autocomplete="current-password" required :aria-describedby="error ? 'login-error' : undefined">
      <p v-if="error" id="login-error" class="admin-error" role="alert">{{ error }}</p>
      <button class="button button-primary button-wide" :disabled="pending">{{ pending ? 'Signing in…' : 'Sign in' }}</button>
    </form>
  </section>
</template>
