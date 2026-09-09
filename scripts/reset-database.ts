import { input } from '@inquirer/prompts'
import postgres from 'postgres'
import { pathToFileURL } from 'node:url'

import { chooseDatabaseEnvironment } from './database-environment'

export type DatabaseResetScope = 'all' | 'pages'

export const resetStatement = (scope: DatabaseResetScope) => scope === 'pages'
  ? 'TRUNCATE TABLE "static_pages"'
  : 'TRUNCATE TABLE "website_indexes", "static_pages", "users" RESTART IDENTITY'

export function productionConfirmationMatches(environmentFile: string, databaseName: string, response: string) {
  return environmentFile === '.env.production' && response === databaseName
}

export async function resetDatabase(
  databaseUrl: string,
  scope: DatabaseResetScope,
  connect: typeof postgres = postgres
) {
  const client = connect(databaseUrl)
  try {
    await client.begin(async transaction => {
      await transaction.unsafe(resetStatement(scope))
    })
  } finally {
    await client.end()
  }
}

export async function runReset(scope: DatabaseResetScope) {
  return runResetWith(scope, {
    chooseEnvironment: chooseDatabaseEnvironment,
    confirmProduction: message => input({ message }),
    reset: resetDatabase,
    log: message => console.log(message)
  })
}

export interface ResetDependencies {
  chooseEnvironment: typeof chooseDatabaseEnvironment
  confirmProduction: (message: string) => Promise<string>
  reset: typeof resetDatabase
  log: (message: string) => void
}

export async function runResetWith(scope: DatabaseResetScope, dependencies: ResetDependencies) {
  const environment = await dependencies.chooseEnvironment()

  if (environment.envFile === '.env.production') {
    const response = await dependencies.confirmProduction(`Type the database name "${environment.databaseName}" to reset it:`)
    if (!productionConfirmationMatches(environment.envFile, environment.databaseName, response)) {
      dependencies.log('Database reset cancelled. No data was deleted.')
      return
    }
  }

  await dependencies.reset(environment.databaseUrl, scope)
  dependencies.log(scope === 'pages'
    ? 'Static page content was reset.'
    : 'Website indexes, users, and static page content were reset.')
}

const scriptPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : ''
if (import.meta.url === scriptPath) {
  const scope = process.argv[2]
  if (scope !== 'all' && scope !== 'pages') throw new Error('Expected reset scope: all or pages.')
  await runReset(scope)
}
