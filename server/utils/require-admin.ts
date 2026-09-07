import type { H3Event } from 'h3'
import { getUserSession, clearUserSession } from '#imports'
import { authorizeAdmin } from '../services/admin-auth'
import { adminRepository } from './admin-repository'

export async function requireAdmin(event: H3Event) {
  try {
    return await authorizeAdmin(await getUserSession(event), adminRepository)
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 401) {
      await clearUserSession(event)
    }
    throw error
  }
}
