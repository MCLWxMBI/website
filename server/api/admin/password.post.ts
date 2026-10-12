import { defineEventHandler, readBody } from 'h3'
import { changeAdminPassword } from '../../services/admin-auth'
import { adminRepository } from '../../utils/admin-repository'
import { requireAdmin } from '../../utils/require-admin'

export default defineEventHandler(async (event) => {
  const session = await requireAdmin(event)
  await changeAdminPassword(session.user.id, await readBody(event), adminRepository)
  return { success: true }
})
