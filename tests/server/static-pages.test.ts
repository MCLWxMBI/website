import { describe, expect, it, vi } from 'vitest'
import type { StaticPage } from '../../server/database/schema'
import { readStaticPage, saveStaticPage, type StaticPageRepository } from '../../server/services/static-pages'
import { sanitizeStaticPageHtml, validateStaticPageHtml } from '../../shared/utils/static-page-content'
import aboutTemplate from '../../app/content/static-pages/about.txt?raw'
import resourcesTemplate from '../../app/content/static-pages/resources.txt?raw'

function stored(contentHtml: string): StaticPage {
  return { slug: 'about', contentHtml, updatedAt: new Date('2026-09-08T12:00:00Z'), updatedBy: 7 }
}

function repository(page?: StaticPage): StaticPageRepository {
  return { bySlug: vi.fn().mockResolvedValue(page), upsert: vi.fn() }
}

describe('static page starter documents', () => {
  it('preserves the About structure and navigation metadata', () => {
    expect(aboutTemplate).toContain('Find the opportunity to have your say.')
    expect(aboutTemplate).toContain('class="about-acknowledgement"')
    expect(aboutTemplate).toContain('class="about-faq"')
    expect(aboutTemplate).toContain('data-page-nav-parent="faq"')
    expect(aboutTemplate).toContain('id="submission-disclaimer"')
    expect(sanitizeStaticPageHtml(aboutTemplate)).toContain('data-page-nav-parent="faq"')
  })

  it('expands the Resources checklist and preserves styled blocks and links', () => {
    expect(resourcesTemplate).not.toContain('v-for')
    expect(resourcesTemplate.match(/class="resource-section"/g)).toHaveLength(8)
    expect(resourcesTemplate).toContain('class="resource-callout"')
    expect(resourcesTemplate).toContain('class="participation-checklist"')
    expect(resourcesTemplate).toContain('data-page-nav-label="Getting started"')
    expect(resourcesTemplate).toContain('https://law.unimelb.edu.au/centres/mcle/research/policy-briefs')
    expect(sanitizeStaticPageHtml(resourcesTemplate)).toContain('data-page-nav-label="Getting started"')
  })
})

describe('static page sanitization', () => {
  it('keeps approved content and normalizes external links and images', () => {
    const clean = sanitizeStaticPageHtml('<h1>Title</h1><p class="resource-prompt unknown">Text</p><a href="https://example.com" target="_blank">Link</a><img src="https://example.com/a.jpg" alt="A view" style="width: 2px">')
    expect(clean).toContain('class="resource-prompt"')
    expect(clean).not.toContain('unknown')
    expect(clean).toContain('rel="noopener noreferrer"')
    expect(clean).toContain('class="static-page-image"')
    expect(clean).toContain('loading="lazy"')
    expect(clean).not.toContain('style=')
  })

  it('removes executable content, unsafe URLs and images without alt text', () => {
    const clean = sanitizeStaticPageHtml('<h1 onclick="alert(1)">Title</h1><script>alert(1)</script><a href="javascript:alert(1)">Bad</a><img src="data:image/png;base64,abc" alt=""><iframe src="https://example.com"></iframe>')
    expect(clean).toBe('<h1>Title</h1><a>Bad</a>')
  })

  it.each([
    '<h1></h1><p>Body content</p>',
    '<h1> &nbsp; </h1><p>Body content</p>',
    '<h1><br></h1><p>Body content</p>',
    '<h1><img src="https://example.com/title.jpg" alt="Title image"></h1><p>Body content</p>'
  ])('rejects a page whose H1 has no text: %s', (html) => {
    expect(() => validateStaticPageHtml(html)).toThrow('title and some text')
  })

  it('accepts title text inside approved inline formatting', () => {
    expect(validateStaticPageHtml('<h1><span><strong>About <em>ECHO</em></strong></span></h1><p>Body</p>'))
      .toContain('<h1><span><strong>About <em>ECHO</em></strong></span></h1>')
  })
})

describe('static page services', () => {
  it('returns an explicit missing response', async () => {
    await expect(readStaticPage('about', repository())).resolves.toEqual({ slug: 'about', exists: false, contentHtml: null, updatedAt: null })
  })

  it('sanitizes stored HTML again on read', async () => {
    const result = await readStaticPage('about', repository(stored('<h1 onclick="bad()">About</h1><p>Text</p>')))
    expect(result).toMatchObject({ exists: true, contentHtml: '<h1>About</h1><p>Text</p>' })
  })

  it('sanitizes and upserts with the administrator and controlled timestamp', async () => {
    const repo = repository()
    const now = new Date('2026-09-08T13:00:00Z')
    vi.mocked(repo.upsert).mockImplementation(async (slug, contentHtml, updatedBy, updatedAt) => ({ slug, contentHtml, updatedBy, updatedAt }))
    const result = await saveStaticPage('about', { contentHtml: '<h1>About</h1><p onclick="bad()">Text</p>' }, 12, repo, now)
    expect(repo.upsert).toHaveBeenCalledWith('about', '<h1>About</h1><p>Text</p>', 12, now)
    expect(result).toMatchObject({ exists: true, updatedAt: now.toISOString() })
  })

  it.each([{}, { contentHtml: '' }, { contentHtml: '<p>No title</p>' }])('rejects malformed page content %#', async (body) => {
    const repo = repository()
    await expect(saveStaticPage('about', body, 1, repo)).rejects.toMatchObject({ statusCode: 400 })
    expect(repo.upsert).not.toHaveBeenCalled()
  })

  it('does not expose database failures', async () => {
    const repo = repository()
    vi.mocked(repo.bySlug).mockRejectedValue(new Error('postgres://secret'))
    await expect(readStaticPage('about', repo)).rejects.toMatchObject({ statusCode: 503 })
    await expect(readStaticPage('about', repo)).rejects.not.toThrow('secret')
  })
})
