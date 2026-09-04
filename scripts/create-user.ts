import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import { input } from '@inquirer/prompts'
import { config } from 'dotenv'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'

import { connectDatabase } from '../server/database'
import { users } from '../server/database/schema'

const usernamePattern = /^[a-z0-9._-]{3,64}$/

const normalizeUsername = (username: string) => username.trim().toLowerCase()

const { values } = parseArgs({
  options: {
    'env-file': {
      type: 'string',
      default: '.env'
    }
  }
})

const envFile = resolve(process.cwd(), values['env-file'])
const envResult = config({
  path: envFile,
  override: true,
  quiet: true
})

if (envResult.error) {
  throw new Error(`Unable to load environment file: ${envFile}`)
}

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error(`DATABASE_URL is required in ${envFile}`)
}

const username = normalizeUsername(await input({
  message: 'Username:'
}))

if (!usernamePattern.test(username)) {
  throw new Error('Username must be 3-64 characters using only letters, numbers, dots, underscores, or hyphens.')
}

const plainPassword = await input({
  message: 'Password:'
})

if (!plainPassword) {
  throw new Error('Password cannot be empty.')
}

const confirmedPassword = await input({
  message: 'Confirm password:'
})

if (plainPassword !== confirmedPassword) {
  throw new Error('Passwords do not match.')
}

const passwordHasher = new Hash(new Scrypt())
const passwordHash = await passwordHasher.make(plainPassword)
const { client, db } = connectDatabase(databaseUrl)

try {
  const [user] = await db
    .insert(users)
    .values({
      username,
      passwordHash,
      role: 'admin'
    })
    .returning({
      id: users.id,
      username: users.username,
      role: users.role
    })

  if (!user) {
    throw new Error('The database did not return the created user.')
  }

  console.log(`Created ${user.role} user ${user.username} (${user.id}).`)
} catch (error) {
  if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
    throw new Error(`Username "${username}" already exists.`)
  }

  throw error
} finally {
  await client.end()
}
