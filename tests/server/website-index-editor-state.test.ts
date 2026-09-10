import { describe, expect, it } from 'vitest'
import type { AdminWebsiteIndex } from '../../shared/types/website-index'
import {
  buildWebsiteIndexUpdateRequest,
  createWebsiteIndexDraft,
  snapshotWebsiteIndexDrafts,
  validateWebsiteIndexDrafts,
  websiteIndexesToDrafts
} from '../../app/utils/website-index-editor-state'

const stored: AdminWebsiteIndex[] = [
  { id: '4', name: 'Alpha', indexUrl: 'https://alpha.example', active: true, notes: null },
  { id: '8', name: 'Beta', indexUrl: 'https://beta.example', active: false, notes: 'Review' }
]

describe('website index editor drafts', () => {
  it('creates clean drafts and new active records without IDs', () => {
    const drafts = websiteIndexesToDrafts(stored)
    expect(snapshotWebsiteIndexDrafts(drafts)).toBe(snapshotWebsiteIndexDrafts(websiteIndexesToDrafts(stored)))
    expect(createWebsiteIndexDraft('new-1')).toEqual({
      key: 'new-1', name: '', indexUrl: '', active: true, notes: '', deleted: false
    })
  })

  it('submits only changed and new rows while staging existing deletions', () => {
    const baseline = websiteIndexesToDrafts(stored)
    const drafts = websiteIndexesToDrafts(stored)
    drafts[0]!.active = false
    drafts[1]!.deleted = true
    drafts.push({ ...createWebsiteIndexDraft('new-1'), name: 'Gamma', indexUrl: 'https://gamma.example' })

    expect(buildWebsiteIndexUpdateRequest(drafts, baseline)).toEqual({
      upserts: [
        { id: '4', name: 'Alpha', indexUrl: 'https://alpha.example', active: false, notes: '' },
        { name: 'Gamma', indexUrl: 'https://gamma.example', active: true, notes: '' }
      ],
      deleteIds: ['8']
    })
  })

  it('supports undo by returning to the original snapshot', () => {
    const drafts = websiteIndexesToDrafts(stored)
    const original = snapshotWebsiteIndexDrafts(drafts)
    drafts[0]!.deleted = true
    expect(snapshotWebsiteIndexDrafts(drafts)).not.toBe(original)
    drafts[0]!.deleted = false
    expect(snapshotWebsiteIndexDrafts(drafts)).toBe(original)
  })

  it('validates names and absolute HTTPS URLs while ignoring staged deletions', () => {
    const draft = createWebsiteIndexDraft('new-1')
    expect(validateWebsiteIndexDrafts([draft])).toContain('name')
    draft.name = 'Example'
    draft.indexUrl = 'http://example.com'
    expect(validateWebsiteIndexDrafts([draft])).toContain('HTTPS')
    draft.deleted = true
    expect(validateWebsiteIndexDrafts([draft])).toBeNull()
  })
})
