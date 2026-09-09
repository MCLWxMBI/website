import type { PageSectionNavItem } from '~/types/page-section-nav'

export interface EditablePageHeading {
  index: number
  id: string
  text: string
  label: string
  parentId: string
  included: boolean
}

export interface EditablePageHeadingUpdate {
  included?: boolean
  label?: string
  parentId?: string
}

const headingSelector = 'h1, h2, h3'

export function listEditablePageHeadings(root: ParentNode): EditablePageHeading[] {
  return Array.from(root.querySelectorAll<HTMLElement>(headingSelector)).map((heading, index) => ({
    index,
    id: heading.id,
    text: heading.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    label: heading.dataset.pageNavLabel ?? '',
    parentId: heading.dataset.pageNavParent ?? '',
    included: Boolean(heading.id && heading.dataset.pageNavLabel?.trim())
  }))
}

export function extractPageNavigation(root: ParentNode): PageSectionNavItem[] {
  const roots: PageSectionNavItem[] = []
  const rootById = new Map<string, PageSectionNavItem>()
  const usedIds = new Set<string>()

  for (const heading of listEditablePageHeadings(root)) {
    const id = heading.id.trim()
    const label = heading.label.trim()
    if (!heading.included || !id || !label || usedIds.has(id)) continue
    usedIds.add(id)
    const item: PageSectionNavItem = { label, href: `#${id}` }
    if (heading.parentId) {
      const parent = rootById.get(heading.parentId)
      if (parent) (parent.children ??= []).push(item)
      continue
    }
    roots.push(item)
    rootById.set(id, item)
  }

  return roots
}

export function normalizeEditablePageNavigation(contentHtml: string): string {
  const document = new DOMParser().parseFromString(contentHtml, 'text/html')
  const elements = Array.from(document.body.querySelectorAll<HTMLElement>(headingSelector))
  const included = elements.map(element => ({
    element,
    id: element.id.trim(),
    label: element.dataset.pageNavLabel?.trim() ?? ''
  }))
  const idCounts = new Map<string, number>()

  for (const heading of included) {
    if (heading.id && heading.label) idCounts.set(heading.id, (idCounts.get(heading.id) ?? 0) + 1)
  }

  const validTopLevelIds = new Set<string>()
  for (const heading of included) {
    if (!heading.id || !heading.label) continue
    const parentId = heading.element.dataset.pageNavParent?.trim() ?? ''
    const validParent = parentId
      && idCounts.get(parentId) === 1
      && validTopLevelIds.has(parentId)

    if (validParent) continue
    if (parentId) delete heading.element.dataset.pageNavParent
    if (idCounts.get(heading.id) === 1) validTopLevelIds.add(heading.id)
  }

  return document.body.innerHTML
}

export function headingId(text: string, existingIds: Set<string>): string {
  const base = text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section'
  let candidate = base
  let suffix = 2
  while (existingIds.has(candidate)) candidate = `${base}-${suffix++}`
  return candidate
}

export function updateEditablePageHeading(contentHtml: string, index: number, update: EditablePageHeadingUpdate): string {
  const document = new DOMParser().parseFromString(contentHtml, 'text/html')
  const elements = Array.from(document.body.querySelectorAll<HTMLElement>(headingSelector))
  const heading = elements[index]
  if (!heading) return contentHtml

  if (update.included === false) {
    const removedId = heading.id
    delete heading.dataset.pageNavLabel
    delete heading.dataset.pageNavParent
    if (removedId) {
      for (const element of elements) {
        if (element.dataset.pageNavParent === removedId) delete element.dataset.pageNavParent
      }
    }
  } else {
    if (update.included === true) {
      const otherIds = new Set(elements.filter(element => element !== heading).map(item => item.id).filter(Boolean))
      if (!heading.id || otherIds.has(heading.id)) heading.id = headingId(heading.textContent ?? '', otherIds)
    }
    if (update.included === true && !heading.dataset.pageNavLabel) {
      heading.dataset.pageNavLabel = heading.textContent?.replace(/\s+/g, ' ').trim() || 'Section'
    }
    if (update.label !== undefined) heading.dataset.pageNavLabel = update.label
    if (update.parentId !== undefined) {
      if (update.parentId) {
        if (heading.id) {
          for (const element of elements) {
            if (element.dataset.pageNavParent === heading.id) delete element.dataset.pageNavParent
          }
        }
        heading.dataset.pageNavParent = update.parentId
      } else delete heading.dataset.pageNavParent
    }
  }

  return document.body.innerHTML
}
