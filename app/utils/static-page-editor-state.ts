export interface StaticPageEditorState {
  canSave: boolean
  dirty: boolean
  status: 'not-published' | 'saved' | 'unsaved'
}

export function getStaticPageEditorState(
  published: boolean,
  contentHtml: string,
  baselineHtml: string
): StaticPageEditorState {
  const dirty = contentHtml !== baselineHtml
  return {
    dirty,
    canSave: !published || dirty,
    status: dirty ? 'unsaved' : published ? 'saved' : 'not-published'
  }
}
