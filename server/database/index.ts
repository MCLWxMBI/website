import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from './schema'

export const connectDatabase = (databaseUrl: string) => {
  const client = postgres(databaseUrl)

  return {
    client,
    db: drizzle(client, { schema })
  }
}
