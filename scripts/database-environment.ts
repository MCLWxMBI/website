import { select } from '@inquirer/prompts'
import { config } from 'dotenv'
import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'

export interface DatabaseEnvironment {
  databaseName: string
  databaseUrl: string
  envFile: string
  envFilePath: string
  maskedDatabaseUrl: string
}

export async function discoverEnvironmentFiles(root = process.cwd()): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true })

  return entries
    .filter(entry => entry.isFile() && /^\.env(?:\..+)?$/.test(entry.name) && entry.name !== '.env.example')
    .map(entry => entry.name)
    .sort((left, right) => left === '.env' ? -1 : right === '.env' ? 1 : left.localeCompare(right))
}

export async function selectEnvironmentFile(
  envFiles: string[],
  prompt: (options: { message: string, choices: Array<{ name: string, value: string }> }) => Promise<string> = options => select(options)
) {
  return prompt({
    message: 'Choose the environment file for this database command:',
    choices: envFiles.map(file => ({ name: file, value: file }))
  })
}

export function parseDatabaseUrl(databaseUrl: string) {
  let parsed: URL
  try {
    parsed = new URL(databaseUrl)
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL.')
  }

  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('DATABASE_URL must use a PostgreSQL postgres:// or postgresql:// protocol.')
  }

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''))
  if (!parsed.hostname || !databaseName) {
    throw new Error('DATABASE_URL must include a host and database name.')
  }

  const masked = new URL(parsed)
  if (masked.password) masked.password = '***'

  return { databaseName, maskedDatabaseUrl: masked.toString() }
}

export async function chooseDatabaseEnvironment(root = process.cwd()): Promise<DatabaseEnvironment> {
  const envFiles = await discoverEnvironmentFiles(root)
  if (!envFiles.length) {
    throw new Error('No environment files were found. Create .env or another project-root .env.* file.')
  }

  const envFile = await selectEnvironmentFile(envFiles)
  const envFilePath = resolve(root, envFile)
  const result = config({ path: envFilePath, override: true, quiet: true })
  if (result.error) throw new Error(`Unable to load environment file: ${envFilePath}`)

  const databaseUrl = result.parsed?.DATABASE_URL
  if (!databaseUrl) throw new Error(`DATABASE_URL is required in ${envFile}`)
  process.env.DATABASE_URL = databaseUrl

  const { databaseName, maskedDatabaseUrl } = parseDatabaseUrl(databaseUrl)
  console.log(`Environment file: ${envFile}`)
  console.log(`Database target: ${maskedDatabaseUrl}`)

  return { databaseName, databaseUrl, envFile, envFilePath, maskedDatabaseUrl }
}
