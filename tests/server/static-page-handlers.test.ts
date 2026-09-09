import { beforeEach, describe, expect, it, vi } from 'vitest'

const repository = vi.hoisted(() => ({ bySlug: vi.fn(), upsert: vi.fn() }))
const requireAdmin = vi.hoisted(() => vi.fn())
const setResponseHeader = vi.hoisted(() => vi.fn())
let slug = 'about'
let body: unknown = { contentHtml: '<h1>About</h1><p>Text</p>' }

vi.mock('../../server/utils/static-page-repository', () => ({ staticPageRepository: repository }))
vi.mock('../../server/utils/require-admin', () => ({ requireAdmin }))
vi.mock('h3', async (original) => ({
  ...await original<typeof import('h3')>(),
  getRouterParam: vi.fn(() => slug),
  readBody: vi.fn(async () => body),
  setResponseHeader
}))

import publicPage from '../../server/api/pages/[slug].get'
import adminPage from '../../server/api/admin/pages/[slug].get'
import savePage from '../../server/api/admin/pages/[slug].put'

const event = {} as Parameters<typeof publicPage>[0]

beforeEach(() => {
  slug = 'about'
  body = { contentHtml: '<h1>About</h1><p>Text</p>' }
  requireAdmin.mockResolvedValue({ user: { id: 42, username: 'admin', role: 'admin' }, expiresAt: Date.now() + 1000 })
  repository.bySlug.mockResolvedValue(undefined)
  repository.upsert.mockImplementation(async (pageSlug, contentHtml, updatedBy, updatedAt) => ({
    slug: pageSlug,
    contentHtml,
    updatedBy,
    updatedAt
  }))
})

describe('static page handlers', () => {
  it('returns the public missing state without caching it', async () => {
    await expect(publicPage(event)).resolves.toMatchObject({ slug: 'about', exists: false })
    expect(setResponseHeader).toHaveBeenCalledWith(event, 'Cache-Control', 'no-store')
  })

  it('rejects unknown public slugs', async () => {
    slug = 'contact'
    await expect(publicPage(event)).rejects.toMatchObject({ statusCode: 404 })
    expect(repository.bySlug).not.toHaveBeenCalled()
  })

  it('authorizes admin reads', async () => {
    await adminPage(event)
    expect(requireAdmin).toHaveBeenCalledWith(event)
    expect(repository.bySlug).toHaveBeenCalledWith('about')
  })

  it('authorizes and attributes saves to the current administrator', async () => {
    const result = await savePage(event)
    expect(requireAdmin).toHaveBeenCalledWith(event)
    expect(repository.upsert).toHaveBeenCalledWith('about', '<h1>About</h1><p>Text</p>', 42, expect.any(Date))
    expect(result).toMatchObject({ slug: 'about', exists: true, contentHtml: '<h1>About</h1><p>Text</p>' })
  })
})
