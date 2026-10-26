import { beforeEach, describe, expect, it, vi } from 'vitest'

const connect = vi.hoisted(() => vi.fn())
vi.mock('../../server/database', () => ({ connectDatabase: connect }))

beforeEach(() => { vi.resetModules(); connect.mockReset() })

describe('runtime opportunity database selection', () => {
  it('connects lazily using DATABASE_URL rather than the seed target', async () => {
    const orderBy = vi.fn().mockResolvedValue([])
    connect.mockReturnValue({ db: { select: () => ({ from: () => ({ orderBy }) }) } })
    vi.stubEnv('DATABASE_URL', 'postgresql://runtime.example/catalogue')
    try {
      const { opportunityRepository } = await import('../../server/utils/opportunity-repository')
      expect(connect).not.toHaveBeenCalled()
      await opportunityRepository.all()
      expect(connect).toHaveBeenCalledWith('postgresql://runtime.example/catalogue')
    } finally { vi.unstubAllEnvs() }
  })

  it('returns a generic unavailable error when DATABASE_URL is missing', async () => {
    vi.stubEnv('DATABASE_URL', '')
    try {
      const { opportunityRepository } = await import('../../server/utils/opportunity-repository')
      const { listOpportunities } = await import('../../server/services/opportunities')
      await expect(listOpportunities(opportunityRepository)).rejects.toMatchObject({ statusCode: 503 })
      expect(connect).not.toHaveBeenCalled()
    } finally { vi.unstubAllEnvs() }
  })
})
