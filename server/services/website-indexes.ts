import { createError } from 'h3'
import type { WebsiteIndex } from '../database/schema'
import type { WebsiteIndexesResponse } from '../../shared/types/website-index'

export type PublicWebsiteIndex = Pick<WebsiteIndex, 'id' | 'name' | 'indexUrl' | 'active'>

export interface WebsiteIndexRepository {
  all: () => Promise<PublicWebsiteIndex[]>
}

const unavailable = () => createError({
  statusCode: 503,
  statusMessage: 'Website index statuses are temporarily unavailable.'
})

export async function listWebsiteIndexes(repository: WebsiteIndexRepository): Promise<WebsiteIndexesResponse> {
  try {
    return (await repository.all()).map(index => ({
      id: index.id.toString(),
      name: index.name,
      indexUrl: index.indexUrl,
      active: index.active
    }))
  } catch {
    throw unavailable()
  }
}
