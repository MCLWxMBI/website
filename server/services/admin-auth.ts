import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import { createError } from 'h3'
import type { User } from '../database/schema'
import type { AdminSession } from '../../shared/types/auth'

export const ADMIN_SESSION_SECONDS = 86_400
const hasher = new Hash(new Scrypt({}))
const unauthorized = () => createError({ statusCode: 401, statusMessage: 'Invalid username or password.' })
const unavailable = () => createError({ statusCode: 503, statusMessage: 'Authentication is temporarily unavailable. Please try again.' })
export interface AdminRepository {
  byUsername: (username: string) => Promise<User | undefined>
  byId: (id: number) => Promise<User | undefined>
}
// A lazily generated dummy hash keeps unknown-user verification on the same hash path.
let dummyHash: Promise<string> | undefined
export async function authenticateAdmin(body: unknown, repository: AdminRepository, now = Date.now()): Promise<AdminSession> {
  if (!body || typeof body !== 'object' || !('username' in body) || !('password' in body)
    || typeof body.username !== 'string' || typeof body.password !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Enter a username and password.' })
  }
  const username = body.username.trim().toLowerCase()
  if (!/^[a-z0-9._-]{3,64}$/.test(username) || !body.password) throw unauthorized()
  let account: User | undefined
  try { account = await repository.byUsername(username) } catch { throw unavailable() }
  const hash = account?.passwordHash ?? await (dummyHash ??= hasher.make('unused-dummy-password'))
  let valid = false
  try { valid = await hasher.verify(hash, body.password) } catch { throw unavailable() }
  if (!account || !valid || account.disabled || account.role !== 'admin') throw unauthorized()
  return {
    user: { id: account.id, username: account.username, role: 'admin' },
    expiresAt: now + ADMIN_SESSION_SECONDS * 1000
  }
}
export async function authorizeAdmin(session: Partial<AdminSession>, repository: AdminRepository, now = Date.now()): Promise<AdminSession> {
  if (!session.user || session.user.role !== 'admin' || !Number.isInteger(session.user.id)
    || !Number.isFinite(session.expiresAt) || now >= session.expiresAt!) {
    throw createError({ statusCode: 401, statusMessage: 'Please sign in again.' })
  }
  let account: User | undefined
  try { account = await repository.byId(session.user.id) } catch { throw unavailable() }
  if (!account || account.disabled || account.role !== 'admin') {
    throw createError({ statusCode: 401, statusMessage: 'Please sign in again.' })
  }
  return { user: { id: account.id, username: account.username, role: 'admin' }, expiresAt: session.expiresAt! }
}
