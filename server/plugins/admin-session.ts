import { defineNitroPlugin, sessionHooks } from '#imports'
import { authorizeAdmin } from '../services/admin-auth'
import { adminRepository } from '../utils/admin-repository'

export default defineNitroPlugin(() => {
  sessionHooks.hook('fetch', async (session) => {
    if (session.user) await authorizeAdmin(session, adminRepository)
  })
})
