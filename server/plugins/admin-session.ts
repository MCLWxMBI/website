import { defineNitroPlugin, sessionHooks } from '#imports'
import { requireAdmin } from '../utils/require-admin'

export default defineNitroPlugin(() => {
  sessionHooks.hook('fetch', async (session, event) => {
    if (session.user) await requireAdmin(event)
  })
})
