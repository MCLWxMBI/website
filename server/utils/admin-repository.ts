import { eq } from 'drizzle-orm'
import { connectDatabase } from '../database'
import { users } from '../database/schema'
import type { AdminRepository } from '../services/admin-auth'

let connection: ReturnType<typeof connectDatabase> | undefined
function database() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required')
  connection ??= connectDatabase(url)
  return connection.db
}
export const adminRepository: AdminRepository = {
  async byUsername(username) {
    return (await database().select().from(users).where(eq(users.username, username)).limit(1))[0]
  },
  async byId(id) {
    return (await database().select().from(users).where(eq(users.id, id)).limit(1))[0]
  }
}
