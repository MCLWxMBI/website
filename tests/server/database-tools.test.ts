import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

import {
  discoverEnvironmentFiles,
  parseDatabaseUrl,
  selectEnvironmentFile,
  type DatabaseEnvironment
} from '../../scripts/database-environment'
import { buildDrizzleInvocation } from '../../scripts/run-drizzle'
import {
  productionConfirmationMatches,
  resetDatabase,
  resetStatement,
  runResetWith
} from '../../scripts/reset-database'

describe('database environment selection', () => {
  it('discovers selectable environment files and excludes examples', async () => {
    const root = await mkdtemp(join(tmpdir(), 'echo-environments-'))
    await Promise.all([
      writeFile(join(root, '.env'), 'DATABASE_URL=postgresql://localhost/dev'),
      writeFile(join(root, '.env.production'), 'DATABASE_URL=postgresql://localhost/prod'),
      writeFile(join(root, '.env.staging'), 'DATABASE_URL=postgresql://localhost/staging'),
      writeFile(join(root, '.env.example'), 'DATABASE_URL=example')
    ])

    await expect(discoverEnvironmentFiles(root)).resolves.toEqual(['.env', '.env.production', '.env.staging'])
  })

  it('masks passwords while retaining enough information to identify the target', () => {
    const parsed = parseDatabaseUrl('postgresql://echo:very-secret@db.example:5432/echo_prod?sslmode=require')
    expect(parsed.databaseName).toBe('echo_prod')
    expect(parsed.maskedDatabaseUrl).toBe('postgresql://echo:***@db.example:5432/echo_prod?sslmode=require')
    expect(parsed.maskedDatabaseUrl).not.toContain('very-secret')
  })

  it('offers every discovered file and returns the selected one', async () => {
    const prompt = vi.fn().mockResolvedValue('.env.production')
    await expect(selectEnvironmentFile(['.env', '.env.production'], prompt)).resolves.toBe('.env.production')
    expect(prompt).toHaveBeenCalledWith({
      message: 'Choose the environment file for this database command:',
      choices: [
        { name: '.env', value: '.env' },
        { name: '.env.production', value: '.env.production' }
      ]
    })
  })

  it('rejects non-PostgreSQL and incomplete targets', () => {
    expect(() => parseDatabaseUrl('https://example.com/database')).toThrow('PostgreSQL')
    expect(() => parseDatabaseUrl('postgresql://localhost')).toThrow('database name')
  })
})

describe('Drizzle command forwarding', () => {
  it('forwards migration names through the public package executable', () => {
    expect(buildDrizzleInvocation('generate', ['--name=add-pages'])).toEqual({
      command: 'npm',
      arguments: ['exec', '--', 'drizzle-kit', 'generate', '--name=add-pages']
    })
  })
})

describe('database reset commands', () => {
  const environment = (envFile: string): DatabaseEnvironment => ({
    envFile,
    envFilePath: `/project/${envFile}`,
    databaseName: 'echo',
    databaseUrl: 'postgresql://echo:secret@localhost/echo',
    maskedDatabaseUrl: 'postgresql://echo:***@localhost/echo'
  })

  it('uses fixed statements for page-only and complete data resets', () => {
    expect(resetStatement('pages')).toBe('TRUNCATE TABLE "static_pages"')
    expect(resetStatement('all')).toBe('TRUNCATE TABLE "website_indexes", "static_pages", "users" RESTART IDENTITY')
  })

  it('runs development resets without a second confirmation', async () => {
    const confirmProduction = vi.fn()
    const reset = vi.fn()
    await runResetWith('pages', {
      chooseEnvironment: vi.fn().mockResolvedValue(environment('.env')),
      confirmProduction,
      reset,
      log: vi.fn()
    })
    expect(confirmProduction).not.toHaveBeenCalled()
    expect(reset).toHaveBeenCalledWith('postgresql://echo:secret@localhost/echo', 'pages')
  })

  it('cancels a production reset unless the database name matches exactly', async () => {
    const reset = vi.fn()
    await runResetWith('all', {
      chooseEnvironment: vi.fn().mockResolvedValue(environment('.env.production')),
      confirmProduction: vi.fn().mockResolvedValue('wrong'),
      reset,
      log: vi.fn()
    })
    expect(reset).not.toHaveBeenCalled()
    expect(productionConfirmationMatches('.env.production', 'echo', 'ECHO')).toBe(false)
  })

  it('allows a production reset after the exact database name is entered', async () => {
    const reset = vi.fn()
    await runResetWith('all', {
      chooseEnvironment: vi.fn().mockResolvedValue(environment('.env.production')),
      confirmProduction: vi.fn().mockResolvedValue('echo'),
      reset,
      log: vi.fn()
    })
    expect(reset).toHaveBeenCalledOnce()
  })

  it('closes the connection after success and failure', async () => {
    const end = vi.fn().mockResolvedValue(undefined)
    const unsafe = vi.fn().mockResolvedValue(undefined)
    const begin = vi.fn(async (callback: (transaction: { unsafe: typeof unsafe }) => Promise<void>) => callback({ unsafe }))
    const connect = vi.fn(() => ({ begin, end }))

    await resetDatabase('postgresql://localhost/echo', 'all', connect as never)
    expect(unsafe).toHaveBeenCalledWith(resetStatement('all'))
    expect(end).toHaveBeenCalledOnce()

    begin.mockRejectedValueOnce(new Error('database failed'))
    await expect(resetDatabase('postgresql://localhost/echo', 'pages', connect as never)).rejects.toThrow('database failed')
    expect(end).toHaveBeenCalledTimes(2)
  })
})
