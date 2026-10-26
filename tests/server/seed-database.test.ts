import { describe, expect, it, vi } from 'vitest'
import { runSeed } from '../../scripts/seed-database'

describe('development seed runner', () => {
  it('ignores DATABASE_URL, runs one transaction, reports counts, and closes the fixed development connection', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://production.example/prod')
    const result = { seeded: 12, skipped: 0, history: 12 }
    const simple = vi.fn().mockResolvedValue([[], [], [result]])
    const unsafe = vi.fn(() => ({ simple }))
    const begin = vi.fn(async callback => callback({ unsafe }))
    const end = vi.fn()
    const connect = vi.fn(() => ({ begin, end }))
    const log = vi.fn()
    try {
      await expect(runSeed(connect as never, log)).resolves.toEqual(result)
      expect(connect).toHaveBeenCalledWith('postgresql://echo:echo@postgres:5432/echo')
      expect(begin).toHaveBeenCalledOnce()
      expect(unsafe).toHaveBeenCalledWith(expect.stringContaining('CREATE TEMP TABLE opportunity_seed'))
      expect(log).toHaveBeenLastCalledWith('Seeded 12 opportunities and 12 history records; skipped 0 deleted URLs.')
      expect(end).toHaveBeenCalledOnce()
    } finally { vi.unstubAllEnvs() }
  })

  it('closes the connection when SQL fails', async () => {
    const failure = new Error('Migration missing')
    const simple = vi.fn().mockRejectedValue(failure)
    const begin = vi.fn(async callback => callback({ unsafe: () => ({ simple }) }))
    const end = vi.fn()
    await expect(runSeed(vi.fn(() => ({ begin, end })) as never, vi.fn())).rejects.toBe(failure)
    expect(end).toHaveBeenCalledOnce()
  })
})
