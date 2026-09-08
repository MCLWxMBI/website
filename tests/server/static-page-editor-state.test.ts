import { describe, expect, it } from 'vitest'

import { getStaticPageEditorState } from '../../app/utils/static-page-editor-state'

describe('static page editor state', () => {
  it('keeps an untouched starter clean while allowing its first publish', () => {
    expect(getStaticPageEditorState(false, '<h1>About</h1>', '<h1>About</h1>')).toEqual({
      dirty: false,
      canSave: true,
      status: 'not-published'
    })
  })

  it('marks a real edit as unsaved', () => {
    expect(getStaticPageEditorState(false, '<h1>Changed</h1>', '<h1>About</h1>')).toEqual({
      dirty: true,
      canSave: true,
      status: 'unsaved'
    })
  })

  it('treats the server result as a clean published baseline after saving', () => {
    const saved = '<h1>Sanitized result</h1>'
    expect(getStaticPageEditorState(true, saved, saved)).toEqual({
      dirty: false,
      canSave: false,
      status: 'saved'
    })
  })

  it('allows a published page to be saved again only after it changes', () => {
    expect(getStaticPageEditorState(true, '<h1>New</h1>', '<h1>Saved</h1>')).toMatchObject({
      dirty: true,
      canSave: true,
      status: 'unsaved'
    })
  })
})
