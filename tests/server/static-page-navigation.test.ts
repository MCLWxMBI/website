// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest'
import { extractPageNavigation, headingId, listEditablePageHeadings, updateEditablePageHeading } from '../../app/utils/page-navigation'

function content(html: string) {
  const root = document.createElement('article')
  root.innerHTML = html
  return root
}

describe('client-side page navigation', () => {
  it('derives labels, order and one nested level from rendered content', () => {
    const root = content(`
      <h1 id="about" data-page-nav-label="About ECHO">Title</h1>
      <h2 id="faq" data-page-nav-label="FAQ">Questions</h2>
      <h3 id="types" data-page-nav-label="Types" data-page-nav-parent="faq">Long question</h3>
    `)
    expect(extractPageNavigation(root)).toEqual([
      { label: 'About ECHO', href: '#about' },
      { label: 'FAQ', href: '#faq', children: [{ label: 'Types', href: '#types' }] }
    ])
  })

  it('ignores duplicates, unmarked headings and missing parents safely', () => {
    const root = content(`
      <h1 id="one" data-page-nav-label="One">One</h1>
      <h2 id="one" data-page-nav-label="Duplicate">Duplicate</h2>
      <h2 id="orphan" data-page-nav-label="Orphan" data-page-nav-parent="missing">Orphan</h2>
      <h2>Unmarked</h2>
    `)
    expect(extractPageNavigation(root)).toEqual([{ label: 'One', href: '#one' }])
    expect(listEditablePageHeadings(root)).toHaveLength(4)
  })

  it('creates readable collision-safe IDs', () => {
    expect(headingId('Getting started!', new Set(['getting-started']))).toBe('getting-started-2')
    expect(headingId('🌱', new Set())).toBe('section')
  })

  it('replaces a duplicate pasted ID when the heading is included', () => {
    const updated = updateEditablePageHeading('<h1 id="section">Title</h1><h2 id="section">Section</h2>', 1, { included: true })
    expect(updated).toContain('<h2 id="section-2" data-page-nav-label="Section">')
  })

  it('marks headings through the editor model and keeps IDs stable', () => {
    const marked = updateEditablePageHeading('<h1 id="intro">Title</h1><h2>Getting started</h2>', 1, { included: true })
    expect(marked).toContain('id="getting-started"')
    expect(marked).toContain('data-page-nav-label="Getting started"')
    const renamed = updateEditablePageHeading(marked.replace('Getting started</h2>', 'First steps</h2>'), 1, { label: 'Start here' })
    expect(renamed).toContain('id="getting-started"')
    expect(renamed).toContain('data-page-nav-label="Start here"')
  })

  it('removes child nesting when its parent is excluded', () => {
    const updated = updateEditablePageHeading(`
      <h2 id="faq" data-page-nav-label="FAQ">FAQ</h2>
      <h3 id="one" data-page-nav-label="One" data-page-nav-parent="faq">One</h3>
    `, 0, { included: false })
    expect(updated).not.toContain('data-page-nav-parent')
    expect(updated).toContain('data-page-nav-label="One"')
  })

  it('promotes children when their parent becomes nested', () => {
    const updated = updateEditablePageHeading(`
      <h2 id="a" data-page-nav-label="A">A</h2>
      <h2 id="b" data-page-nav-label="B">B</h2>
      <h3 id="c" data-page-nav-label="C" data-page-nav-parent="b">C</h3>
      <h2 id="d" data-page-nav-label="D">D</h2>
    `, 1, { parentId: 'a' })
    const root = content(updated)

    expect(root.querySelector('#b')?.getAttribute('data-page-nav-parent')).toBe('a')
    expect(root.querySelector('#c')?.hasAttribute('data-page-nav-parent')).toBe(false)
    expect(extractPageNavigation(root)).toEqual([
      { label: 'A', href: '#a', children: [{ label: 'B', href: '#b' }] },
      { label: 'C', href: '#c' },
      { label: 'D', href: '#d' }
    ])
  })

  it('does not alter unrelated one-level nesting', () => {
    const updated = updateEditablePageHeading(`
      <h2 id="a" data-page-nav-label="A">A</h2>
      <h2 id="b" data-page-nav-label="B">B</h2>
      <h3 id="c" data-page-nav-label="C" data-page-nav-parent="a">C</h3>
    `, 1, { label: 'Renamed B' })

    expect(content(updated).querySelector('#c')?.getAttribute('data-page-nav-parent')).toBe('a')
  })
})
