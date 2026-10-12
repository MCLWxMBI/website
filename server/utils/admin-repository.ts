import { and, eq } from 'drizzle-orm'
import { connectDatabase } from '../database'
import { users } from '../database/schema'
import type { AdminPasswordRepository, AdminRepository } from '../services/admin-auth'

let connection: ReturnType<typeof connectDatabase> | undefined
function database() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required')
  connection ??= connectDatabase(url)
  return connection.db
}
export const adminRepository: AdminRepository & AdminPasswordRepository = {
  async byUsername(username) {
    return (await database().select().from(users).where(eq(users.username, username)).limit(1))[0]
  },
  async updatePassword(id, passwordHash) {
    const updated = await database().update(users).set({ passwordHash })
      .where(and(eq(users.id, id), eq(users.role, 'admin'), eq(users.disabled, false)))
      .returning({ id: users.id })
    return updated.length === 1
  },
  async byId(id) {
    return (await database().select().from(users).where(eq(users.id, id)).limit(1))[0]
  }
}
