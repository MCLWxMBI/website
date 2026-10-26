import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OpportunityRecord } from '../../server/database/schema'

const repository = vi.hoisted(() => ({ all: vi.fn(), findDetailById: vi.fn() }))
const headers = vi.hoisted(() => vi.fn())
let id: string | undefined = 'another-consultation'

vi.mock('../../server/utils/opportunity-repository', () => ({ opportunityRepository: repository }))
vi.mock('h3', async original => ({
  ...await original<typeof import('h3')>(),
  getRouterParam: () => id,
  setResponseHeader: headers
}))

import list from '../../server/api/opportunities/index.get'
import detail from '../../server/api/opportunities/[id].get'

const row: OpportunityRecord = {
  id: 'another-consultation', title: 'A database consultation', fullText: ['Full text.'],
  sourceUrl: 'https://example.gov.au/another-consultation', websiteId: 'new-platform',
  sourceOrg: 'New authority', jurisdiction: 'Commonwealth', startDate: null,
  submissionDeadline: new Date('2026-11-01T00:00:00Z'), submissionDeadlinePrecision: 'month',
  category: ['Climate change'], tags: null, summary: null, location: null
}
const event = {} as Parameters<typeof list>[0]

beforeEach(() => {
  id = row.id
  repository.all.mockResolvedValue([row])
  repository.findDetailById.mockResolvedValue({ opportunity: row, websiteTags: ['New database feature'] })
})

describe('public opportunity APIs', () => {
  it('lists arbitrary database records without caching or exposing storage details', async () => {
    const result = await list(event)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ id: row.id, website: 'new-platform', submissionDeadline: '2026-11' })
    for (const field of ['websiteId', 'submissionDeadlinePrecision', 'hash', 'deleted', 'status']) {
      expect(result[0]).not.toHaveProperty(field)
    }
    expect(headers).toHaveBeenCalledWith(event, 'Cache-Control', 'no-store')
  })

  it('returns an empty array for an empty database', async () => {
    repository.all.mockResolvedValue([])
    await expect(list(event)).resolves.toEqual([])
  })

  it('reads one opportunity with its database website features', async () => {
    const result = await detail(event)
    expect(repository.findDetailById).toHaveBeenCalledWith(row.id)
    expect(result.opportunity.submissionDeadline).toBe('2026-11')
    expect(result.websiteTags).toEqual(['New database feature'])
    expect(headers).toHaveBeenCalledWith(event, 'Cache-Control', 'no-store')
  })

  it('returns 404 for a missing opportunity', async () => {
    repository.findDetailById.mockResolvedValue(null)
    await expect(detail(event)).rejects.toMatchObject({ statusCode: 404 })
  })

  it.each([undefined, '', ' '])('rejects an empty detail ID (%s)', async value => {
    id = value
    await expect(detail(event)).rejects.toMatchObject({ statusCode: 404 })
    expect(repository.findDetailById).not.toHaveBeenCalled()
  })

  it.each(['list', 'detail'])('turns %s storage failures into a generic 503', async endpoint => {
    const failure = new Error('Private database configuration')
    repository.all.mockRejectedValue(failure)
    repository.findDetailById.mockRejectedValue(failure)
    await expect((endpoint === 'list' ? list : detail)(event)).rejects.toMatchObject({
      statusCode: 503, statusMessage: 'Opportunities are temporarily unavailable.'
    })
  })
})
