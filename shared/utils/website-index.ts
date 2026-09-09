import type { WebsiteIndexResponse } from '../types/website-index'

export type WebsiteIndexesViewState = 'table' | 'maintenance'

export function getWebsiteIndexesViewState(
  indexes: WebsiteIndexResponse[],
  requestFailed: boolean
): WebsiteIndexesViewState {
  return requestFailed || indexes.length === 0 ? 'maintenance' : 'table'
}

export function getWebsiteIndexStatus(active: boolean) {
  return active
    ? { emoji: '✅', label: 'Active' }
    : { emoji: '❌', label: 'Inactive' }
}
