import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WebsiteIndexRepository } from '../../server/services/website-indexes'
import { listWebsiteIndexes } from '../../server/services/website-indexes'

const repositoryMock = vi.hoisted(() => ({ all: vi.fn() }))
const setResponseHeader = vi.hoisted(() => vi.fn())

vi.mock('../../server/utils/website-index-repository', () => ({
  websiteIndexRepository: repositoryMock
}))

vi.mock('h3', async (original) => ({
  ...await original<typeof import('h3')>(),
  setResponseHeader
}))

import indexesHandler from '../../server/api/indexes.get'

const rows = [
  { id: 3n, name: 'Australian Government', indexUrl: 'https://example.gov.au/consultations', active: true },
  { id: 9n, name: 'Barwon Water', indexUrl: 'https://example.com.au/engage', active: false }
]

describe('website index service', () => {
  it('serializes bigint IDs and returns only public fields', async () => {
    const repository: WebsiteIndexRepository = { all: vi.fn().mockResolvedValue(rows) }

    await expect(listWebsiteIndexes(repository)).resolves.toEqual([
      { id: '3', name: 'Australian Government', indexUrl: 'https://example.gov.au/consultations', active: true },
      { id: '9', name: 'Barwon Water', indexUrl: 'https://example.com.au/engage', active: false }
    ])
  })

  it('returns a generic unavailable error without leaking database details', async () => {
    const repository: WebsiteIndexRepository = {
      all: vi.fn().mockRejectedValue(new Error('postgresql://echo:secret@postgres/echo'))
    }

    await expect(listWebsiteIndexes(repository)).rejects.toMatchObject({
      statusCode: 503,
      statusMessage: 'Website index statuses are temporarily unavailable.'
    })
    await expect(listWebsiteIndexes(repository)).rejects.not.toThrow('secret')
  })
})

describe('website index handler', () => {
  beforeEach(() => repositoryMock.all.mockResolvedValue(rows))

  it('returns current statuses without caching them', async () => {
    const event = {} as Parameters<typeof indexesHandler>[0]

    await expect(indexesHandler(event)).resolves.toEqual([
      { id: '3', name: 'Australian Government', indexUrl: 'https://example.gov.au/consultations', active: true },
      { id: '9', name: 'Barwon Water', indexUrl: 'https://example.com.au/engage', active: false }
    ])
    expect(setResponseHeader).toHaveBeenCalledWith(event, 'Cache-Control', 'no-store')
    expect(JSON.stringify(await indexesHandler(event))).not.toContain('notes')
  })
})
