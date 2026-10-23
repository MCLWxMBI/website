import { spawnSync } from 'node:child_process'
import { chooseDatabaseEnvironment } from './database-environment'

const environment = await chooseDatabaseEnvironment()
// Tests only create/drop their own randomly named databases, never reset this one.
const result = spawnSync('npm', ['exec', '--', 'vitest', 'run', '--config', 'vitest.database.config.ts'], {
  env: { ...process.env, TEST_DATABASE_URL: environment.databaseUrl },
  stdio: 'inherit'
})
if (result.error) throw result.error
process.exitCode = result.status ?? 1
