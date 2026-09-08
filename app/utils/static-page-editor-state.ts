export interface StaticPageEditorState {
  canSave: boolean
  dirty: boolean
  status: 'not-published' | 'saved' | 'unsaved'
}

export interface EditorReadyContent {
  baselineHtml: string
  contentHtml: string
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

export function resolveEditorReadyContent(
  contentHtml: string,
  baselineHtml: string,
  normalizedHtml: string,
  preservePreReadyChange: boolean
): EditorReadyContent {
  if (preservePreReadyChange) return { contentHtml, baselineHtml }
  return { contentHtml: normalizedHtml, baselineHtml: normalizedHtml }
}
