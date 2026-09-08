import { describe, expect, it } from 'vitest'

import { getStaticPageEditorState, resolveEditorReadyContent } from '../../app/utils/static-page-editor-state'

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

describe('Jodit-ready baseline resolution', () => {
  it('preserves stored content as the baseline after a published pre-ready template reload', () => {
    const ready = resolveEditorReadyContent(
      '<h1>Original template</h1>',
      '<h1>Stored page</h1>',
      '<h1>Normalized original template</h1>',
      true
    )

    expect(ready).toEqual({
      contentHtml: '<h1>Original template</h1>',
      baselineHtml: '<h1>Stored page</h1>'
    })
    expect(getStaticPageEditorState(true, ready.contentHtml, ready.baselineHtml)).toMatchObject({
      dirty: true,
      canSave: true,
      status: 'unsaved'
    })
  })

  it('adopts the normalized template as a clean unpublished baseline', () => {
    const ready = resolveEditorReadyContent(
      '<h1>Original template</h1>',
      '<h1>Original template</h1>',
      '<h1>Normalized template</h1>',
      false
    )

    expect(getStaticPageEditorState(false, ready.contentHtml, ready.baselineHtml)).toEqual({
      dirty: false,
      canSave: true,
      status: 'not-published'
    })
  })

  it.each([false, true])('keeps ordinary Jodit normalization clean when published is %s', (published) => {
    const ready = resolveEditorReadyContent(
      '<h1>Loaded page</h1>',
      '<h1>Loaded page</h1>',
      '<h1>Normalized loaded page</h1>',
      false
    )

    expect(ready.contentHtml).toBe(ready.baselineHtml)
    expect(getStaticPageEditorState(published, ready.contentHtml, ready.baselineHtml).dirty).toBe(false)
  })
})
