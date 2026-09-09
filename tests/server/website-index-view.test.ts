import { describe, expect, it } from 'vitest'
import { getWebsiteIndexesViewState, getWebsiteIndexStatus } from '../../shared/utils/website-index'

const index = { id: '1', name: 'Example', indexUrl: 'https://example.com', active: true }

describe('website index presentation', () => {
  it('uses the maintenance state for empty results and failed requests', () => {
    expect(getWebsiteIndexesViewState([], false)).toBe('maintenance')
    expect(getWebsiteIndexesViewState([], true)).toBe('maintenance')
    expect(getWebsiteIndexesViewState([index], true)).toBe('maintenance')
  })

  it('shows the table only for a successful non-empty result', () => {
    expect(getWebsiteIndexesViewState([index], false)).toBe('table')
  })

  it('provides emoji and written labels for both statuses', () => {
    expect(getWebsiteIndexStatus(true)).toEqual({ emoji: '✅', label: 'Active' })
    expect(getWebsiteIndexStatus(false)).toEqual({ emoji: '❌', label: 'Inactive' })
  })
})
