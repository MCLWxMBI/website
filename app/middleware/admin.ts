import type { AdminSession } from '../../shared/types/auth'

export default defineNuxtRouteMiddleware(async (to) => {
  try {
    await useRequestFetch()<AdminSession>('/api/admin/session')
    if (to.path === '/admin/login') return navigateTo('/admin')
  } catch (error) {
    const status = error && typeof error === 'object' && 'statusCode' in error ? error.statusCode : undefined
    if (status === 401) {
      if (to.path !== '/admin/login') return navigateTo('/admin/login')
      return
    }
    throw createError({ statusCode: 503, statusMessage: 'Authentication is temporarily unavailable. Please try again.' })
  }
})
