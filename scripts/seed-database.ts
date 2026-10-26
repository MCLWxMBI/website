import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import postgres from 'postgres'

// Deliberately independent of DATABASE_URL and environment-file selection.
export const developmentDatabaseUrl = 'postgresql://echo:echo@postgres:5432/echo'

export interface SeedResult {
  seeded: number
  skipped: number
  history: number
}

// Accept a connection so database tests can use their isolated temporary databases.
export async function seedDatabase(client: ReturnType<typeof postgres>): Promise<SeedResult> {
  const sql = await readFile(new URL('./seed.sql', import.meta.url), 'utf8')
  return client.begin(async transaction => {
    // postgres-js returns one result set per statement in simple-query mode.
    const results = await transaction.unsafe(sql).simple() as unknown as postgres.RowList<SeedResult[]>[]
    const result = results.at(-1)?.[0]
    if (!result || !Number.isInteger(result.seeded)) throw new Error('Seed SQL did not return its result counts.')
    return result
  })
}

export async function runSeed(connect: typeof postgres = postgres, log = console.log): Promise<SeedResult> {
  log('Seeding development PostgreSQL at postgres:5432/echo (DATABASE_URL is ignored).')
  const client = connect(developmentDatabaseUrl)
  try {
    const result = await seedDatabase(client)
    log(`Seeded ${result.seeded} opportunities and ${result.history} history records; skipped ${result.skipped} deleted URLs.`)
    return result
  } finally {
    await client.end()
  }
}

const scriptPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : ''
if (import.meta.url === scriptPath) await runSeed()
