import type {
  AdminWebsiteIndex,
  UpdateWebsiteIndexesRequest,
  WebsiteIndexUpsertRequest
} from '~~/shared/types/website-index'

export interface WebsiteIndexDraft {
  key: string
  id?: string
  name: string
  indexUrl: string
  active: boolean
  notes: string
  deleted: boolean
}

export function websiteIndexesToDrafts(indexes: AdminWebsiteIndex[]): WebsiteIndexDraft[] {
  return indexes.map(index => ({
    key: `id-${index.id}`,
    id: index.id,
    name: index.name,
    indexUrl: index.indexUrl,
    active: index.active,
    notes: index.notes ?? '',
    deleted: false
  }))
}

export function createWebsiteIndexDraft(key: string): WebsiteIndexDraft {
  return { key, name: '', indexUrl: '', active: true, notes: '', deleted: false }
}

export function snapshotWebsiteIndexDrafts(drafts: WebsiteIndexDraft[]): string {
  return JSON.stringify(drafts)
}

function editableSnapshot(draft: WebsiteIndexDraft) {
  return JSON.stringify({
    name: draft.name,
    indexUrl: draft.indexUrl,
    active: draft.active,
    notes: draft.notes
  })
}

export function buildWebsiteIndexUpdateRequest(
  drafts: WebsiteIndexDraft[],
  baseline: WebsiteIndexDraft[] = []
): UpdateWebsiteIndexesRequest {
  const baselineById = new Map(baseline.flatMap(draft => draft.id ? [[draft.id, draft] as const] : []))
  const upserts: WebsiteIndexUpsertRequest[] = drafts
    .filter((draft) => {
      if (draft.deleted) return false
      if (!draft.id) return true
      const original = baselineById.get(draft.id)
      return !original || editableSnapshot(draft) !== editableSnapshot(original)
    })
    .map((draft) => {
      const item: WebsiteIndexUpsertRequest = {
        name: draft.name,
        indexUrl: draft.indexUrl,
        active: draft.active,
        notes: draft.notes
      }
      if (draft.id) item.id = draft.id
      return item
    })

  return {
    upserts,
    deleteIds: drafts.flatMap(draft => draft.deleted && draft.id ? [draft.id] : [])
  }
}

export function validateWebsiteIndexDrafts(drafts: WebsiteIndexDraft[]): string | null {
  for (const draft of drafts) {
    if (draft.deleted) continue
    const name = draft.name.trim()
    if (!name) return 'Enter a name for every website index.'
    if (name.length > 255) return 'Website index names cannot exceed 255 characters.'
    try {
      const url = new URL(draft.indexUrl.trim())
      if (url.protocol !== 'https:') return 'Enter an absolute HTTPS index URL for every website.'
    } catch {
      return 'Enter an absolute HTTPS index URL for every website.'
    }
  }
  return null
}
