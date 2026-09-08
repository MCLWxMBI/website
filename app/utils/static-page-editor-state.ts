export interface StaticPageEditorState {
  canSave: boolean
  dirty: boolean
  status: 'not-published' | 'saved' | 'unsaved'
}

export interface EditorReadyContent {
  baselineHtml: string
  contentHtml: string
}

export interface SavedEditorContent {
  baselineHtml: string
  contentHtml: string
}

export interface ReadOnlyEditor {
  setReadOnly: (readOnly: boolean) => void
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

export function reconcileSavedEditorContent(
  currentHtml: string,
  submittedHtml: string,
  storedHtml: string
): SavedEditorContent {
  return {
    contentHtml: currentHtml === submittedHtml ? storedHtml : currentHtml,
    baselineHtml: storedHtml
  }
}

export function applyEditorReadOnly(editor: ReadOnlyEditor | undefined, readOnly: boolean) {
  editor?.setReadOnly(readOnly)
}
