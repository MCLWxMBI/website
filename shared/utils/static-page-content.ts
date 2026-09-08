import sanitizeHtml from 'sanitize-html'

const allowedClasses = [
  'about-acknowledgement',
  'about-body',
  'about-disclaimer',
  'about-faq',
  'comparison-list',
  'faq-entry',
  'faq-numbered-list',
  'faq-section',
  'faq-steps',
  'footnote-marker',
  'participation-checklist',
  'resource-attribution',
  'resource-callout',
  'resource-encouragement',
  'resource-intro',
  'resource-list',
  'resource-prompt',
  'resource-section',
  'resource-steps',
  'section-kicker',
  'sr-only',
  'static-page-image'
]

const options: sanitizeHtml.IOptions = {
  allowedTags: [
    'a', 'blockquote', 'br', 'div', 'em', 'figcaption', 'figure', 'footer',
    'h1', 'h2', 'h3', 'h4', 'header', 'img', 'li', 'ol', 'p', 'section',
    'span', 'strong', 'sup', 'ul'
  ],
  allowedAttributes: {
    '*': ['aria-hidden', 'aria-label', 'aria-labelledby', 'class', 'id', 'tabindex'],
    a: ['href', 'rel', 'target'],
    h1: ['data-page-nav-label', 'data-page-nav-parent'],
    h2: ['data-page-nav-label', 'data-page-nav-parent'],
    h3: ['data-page-nav-label', 'data-page-nav-parent'],
    img: ['alt', 'class', 'decoding', 'loading', 'src', 'title'],
    ol: ['type']
  },
  allowedClasses: { '*': allowedClasses },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  allowProtocolRelative: false,
  transformTags: {
    a: (_tagName, attributes) => ({
      tagName: 'a',
      attribs: attributes.target === '_blank'
        ? { ...attributes, rel: 'noopener noreferrer' }
        : attributes
    }),
    img: (_tagName, attributes) => ({
      tagName: 'img',
      attribs: {
        ...attributes,
        class: [...new Set(`${attributes.class ?? ''} static-page-image`.trim().split(/\s+/))].join(' '),
        loading: 'lazy',
        decoding: 'async'
      }
    })
  },
  exclusiveFilter: frame => frame.tag === 'img' && (!frame.attribs.src || !frame.attribs.alt?.trim())
}

export function sanitizeStaticPageHtml(contentHtml: string): string {
  return sanitizeHtml(contentHtml, options).trim()
}

export function validateStaticPageHtml(contentHtml: unknown): string {
  if (typeof contentHtml !== 'string') throw new Error('Page content must be HTML text.')
  if (contentHtml.length > 300_000) throw new Error('Page content is too large.')
  const clean = sanitizeStaticPageHtml(contentHtml)
  const text = sanitizeHtml(clean, { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, ' ').trim()
  if (!text || !/<h1(?:\s|>)/i.test(clean)) throw new Error('Page content must include a title and some text.')
  return clean
}
