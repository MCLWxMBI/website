<script setup lang="ts">
import { validateAdminPassword } from '~~/shared/utils/admin-password'

definePageMeta({ layout: 'admin', middleware: 'admin' })
useSeoMeta({ title: 'Change password' })
const newPassword = ref('')
const confirmPassword = ref('')
const pending = ref(false)
const error = ref('')
const success = ref(false)
const { $csrfFetch } = useNuxtApp()
const { fetch: refreshSession } = useUserSession()

async function changePassword() {
  if (pending.value) return
  success.value = false
  const body = { newPassword: newPassword.value, confirmPassword: confirmPassword.value }
  error.value = validateAdminPassword(body) ?? ''
  if (error.value) return
  pending.value = true
  try {
    await $csrfFetch('/api/admin/password', { method: 'POST', body })
    newPassword.value = ''
    confirmPassword.value = ''
    success.value = true
  } catch (cause) {
    const status = cause && typeof cause === 'object' && 'statusCode' in cause ? cause.statusCode : undefined
    if (status === 401) {
      newPassword.value = ''
      confirmPassword.value = ''
      await refreshSession().catch(() => {})
      await navigateTo('/admin/login')
      return
    }
    error.value = status === 403 ? 'Your security token could not be verified. Reload this page and try again.'
      : status === 400 ? 'Enter a non-empty password and make sure both passwords match.'
      : 'Unable to change your password. Please try again.'
  } finally { pending.value = false }
}
</script>

<template>
  <section class="admin-card admin-login" aria-labelledby="password-title">
    <NuxtLink to="/admin" class="admin-view-link">← Back to Administration</NuxtLink>
    <h1 id="password-title">Change password</h1>
    <p>Set a new password for your administrator account.</p>
    <form class="admin-form" :aria-busy="pending" @submit.prevent="changePassword">
      <label for="new-password">New password</label>
      <input id="new-password" v-model="newPassword" name="newPassword" type="password" autocomplete="new-password" required :disabled="pending" :aria-invalid="error ? true : undefined" :aria-describedby="error ? 'password-error' : undefined" @input="success = false; error = ''">
      <label for="confirm-password">Re-type new password</label>
      <input id="confirm-password" v-model="confirmPassword" name="confirmPassword" type="password" autocomplete="new-password" required :disabled="pending" :aria-invalid="error ? true : undefined" :aria-describedby="error ? 'password-error' : undefined" @input="success = false; error = ''">
      <p v-if="error" id="password-error" class="admin-error" role="alert">{{ error }}</p>
      <p v-if="success" class="admin-success" role="status">Password changed.</p>
      <button class="button button-primary button-wide" type="submit" :disabled="pending">{{ pending ? 'Saving…' : 'Change password' }}</button>
    </form>
  </section>
</template>
