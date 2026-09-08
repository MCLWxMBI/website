import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

import { chooseDatabaseEnvironment } from './database-environment'

export type DrizzleCommand = 'generate' | 'migrate'

export function buildDrizzleInvocation(command: DrizzleCommand, forwardedArguments: string[]) {
  return {
    command: 'npm',
    arguments: ['exec', '--', 'drizzle-kit', command, ...forwardedArguments]
  }
}

export async function runDrizzle(command: DrizzleCommand, forwardedArguments: string[]) {
  const environment = await chooseDatabaseEnvironment()
  const invocation = buildDrizzleInvocation(command, forwardedArguments)
  const result = spawnSync(invocation.command, invocation.arguments, {
    env: { ...process.env, DATABASE_URL: environment.databaseUrl },
    stdio: 'inherit'
  })

  if (result.error) throw result.error
  if (result.status !== 0) process.exitCode = result.status ?? 1
}

const scriptPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : ''
if (import.meta.url === scriptPath) {
  const [command, ...forwardedArguments] = process.argv.slice(2)
  if (command !== 'generate' && command !== 'migrate') {
    throw new Error('Expected a Drizzle command: generate or migrate.')
  }
  await runDrizzle(command, forwardedArguments)
}
