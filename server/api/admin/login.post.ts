import { defineEventHandler, readBody } from 'h3'
import { replaceUserSession } from '#imports'
import { authenticateAdmin, ADMIN_SESSION_SECONDS } from '../../services/admin-auth'
import { adminRepository } from '../../utils/admin-repository'

export default defineEventHandler(async (event) => {
  const session = await authenticateAdmin(await readBody(event), adminRepository)
  await replaceUserSession(event, { ...session }, { maxAge: ADMIN_SESSION_SECONDS })
  return session
})
