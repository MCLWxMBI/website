# ECHO design guide

> **Status:** Approved.

## Visual direction

### Brand

- The product name is **ECHO**.
- The leaf line mark communicates environment and growth without relying on
  photography or decorative illustration.
- The expanded label “Environmental consultations” can accompany the brand on
  larger screens. The compact mobile header uses ECHO alone.
- The visual tone is modern SaaS with restrained environmental and civic cues:
  structured cards, strong hierarchy, generous whitespace, soft borders, and
  deep green accents.

### Colour

The implemented CSS variables in `app/assets/css/main.css` are the source of
truth. Their intended roles are:

| Token | Value | Use |
| --- | --- | --- |
| `--ink` | `#14251f` | Primary text |
| `--muted` | `#64716c` | Secondary text |
| `--line` | `#dce5e0` | Borders and dividers |
| `--surface` | `#ffffff` | Cards and primary surfaces |
| `--soft` | `#f4f7f5` | Subtle controls and backgrounds |
| `--green-900` | `#0c3f33` | Hero, dark brand surfaces |
| `--green-700` | `#12634e` | Links, controls, primary actions |
| `--green-100` | `#dcf5e9` | Soft positive accents |
| `--lime` | `#cce85a` | Selective hero and logo highlight |

Lime is an accent, not a general background or body-text colour. Status must not
be communicated by colour alone: every status treatment includes a written
label.

### Typography

- **Manrope** is used for headings, important dates, and the ECHO wordmark.
- **DM Sans** is used for body copy, controls, labels, and supporting content.
- Headings use tight tracking and strong weights to establish the product-like
  character. Body copy uses comfortable line height and muted colour.
- The CSS imports both families from Google Fonts and provides system fallbacks.
  If font delivery changes, preserve the two-font hierarchy or choose a close
  geometric heading and neutral sans-serif body pairing.

### Shape, spacing, and depth

- Content is constrained to a maximum width of 1180px with 24px desktop side
  margins and 16px mobile side margins.
- Major cards use 13–18px corner radii. Controls use 6–12px radii. Status badges
  use pill shapes.
- Borders are preferred over shadows for default separation. Shadows and a
  three-pixel lift appear on opportunity-card hover.
- Spacing should remain open and regular. Avoid dense dashboard layouts or
  introducing unrelated decorative patterns.

## Pages and components

### Shared shell

The header contains the ECHO brand and Opportunities, About, and Resources
navigation items. The footer repeats the brand, product purpose, and pilot
jurisdiction.

### Opportunity catalogue

The homepage has two visual zones:

- A dark-green hero introduces ECHO, highlights “shape change” in lime, and
  contains the primary search field. The dot texture and outlined circles add
  depth without competing with the content.
- A pale catalogue surface opens with a centred MCLE tagline, followed by the
  result count, filters, opportunity cards, empty state, and numbered
  pagination.

On desktop, filters occupy a sticky 230px left sidebar and cards appear in three
columns. The grid falls to two columns below 1050px. Below 760px, cards use one
column and filters move into a right-side modal drawer.

Search covers titles, summaries, publishers, jurisdictions, and categories.
Filters cover location, category, and status. Status is derived from the
server-synchronised UTC time: an opportunity is closed at or after its
submission deadline, upcoming before a supplied start time, and open otherwise.
A missing start time defaults to open until the deadline. Search and filter state is encoded
in URL query parameters so views can be shared and restored. Empty results must
explain what happened and provide a clear reset action.

### About

The `/about` page introduces the MCLE initiative and the public opportunities
it brings together. A centred heading and italic acknowledgement of Country
lead into the project description, a Roman-numeral list of government and
public-sector sources, and a reminder that every listing links to its official
source. A linked footnote leads to a bottom disclaimer clarifying that ECHO
does not run consultations or receive submissions. Before that disclaimer, an
expanded FAQ explains consultation process types, the five topic categories,
and four steps for using ECHO.

A compact “On this page” navigation tile links to the About introduction, FAQ,
and its three main subsections. On wide desktop screens, the article remains
centred while the tile stays sticky in a balanced right-side rail. At smaller
widths, the tile moves above the article and scrolls normally with the page.

### Resources

The `/resources` page presents MCLE's plain-language guide to taking part in
Australian public consultations. It explains public submissions, how to plan
and structure a contribution, how submissions can influence decisions, what
should happen after submission, and considerations for consultation designers.
A static participation checklist helps readers review a submission without
implying that checklist state is saved.

Resources and About share a compact “On this page” navigation tile. On wide
desktop screens, the article remains centred while the tile stays sticky in a
balanced right-side rail. At smaller widths, the tile moves above the article
and scrolls normally with the page. The Resources page ends with “Further
readings”; each item is a clearly labelled external link that opens the
University of Melbourne website in a new tab.

### Opportunity card

Cards use a consistent information order:

1. Status and jurisdiction.
2. Publishing organisation.
3. Opportunity title and concise summary.
4. Up to two category tags.
5. Relevant date and a clear detail-page affordance.

The whole hierarchy should make the title and deadline scannable before
supporting details. Status labels are “Open now”, “Upcoming”, and “Closed”.
Upcoming cards show the start date; open and closed cards show the submission
deadline.

### Opportunity detail

The detail route is `/opportunities/[id]`. The main column contains status,
jurisdiction, publisher, title, summary, categories, and consultation
description. A sticky desktop sidebar highlights features of the publisher's
website, gives the opening date when supplied and always gives the submission
deadline, and provides a primary link to the official consultation.

ECHO links to the publisher’s original page rather than storing downloadable
documents. The detail page intentionally does not display public contact
details or a documents section. On mobile, the website features, dates, and
official-source action move above the main description.

### Geographic map

When an opportunity has geographic data, its detail page shows an “Area
affected” map after the consultation description. The map begins with an
Australia-wide view before focusing on the supplied geometry. Point locations
use a deep-green ECHO marker with a lime centre; Polygon and MultiPolygon areas
use a deep-green outline and translucent green fill.

Maps are 380px high on larger screens and 300px high below the 760px mobile
breakpoint. Scroll-wheel zoom is disabled so the page remains easy to scroll,
while visible zoom controls, dragging, touch interaction, and keyboard focus
remain available. The readable location label and map attribution must always
be visible. Opportunities without geographic data do not show an empty map
section.

## Interaction and accessibility

- All interactive elements must remain keyboard operable with a visible focus
  ring. Use semantic buttons, links, labels, fieldsets, and headings.
- External consultation links open in a new tab, include `rel="noopener"`, and
  explain that the user is leaving ECHO.
- Controls require accessible names; icon-only controls require explicit
  `aria-label` text.
- Text and essential controls must meet WCAG AA contrast. Never rely on hover,
  colour, or an icon alone to convey state.
- Respect `prefers-reduced-motion`. Motion should be short and functional.
- Preserve the current breakpoint behavior unless a changed layout is tested at
  desktop, tablet, and narrow-mobile widths.

## Implementation reference

- Global tokens and responsive rules: `app/assets/css/main.css`
- Shared page chrome: `app/layouts/default.vue`
- Catalogue page and URL state: `app/pages/index.vue`
- Detail page: `app/pages/opportunities/[id].vue`
- Reusable catalogue UI: `app/components/`
- Client-only opportunity map: `app/components/OpportunityMap.client.vue`
- Opportunity schema and allowed values: `app/types/opportunity.ts`

Before changing the interface, check whether the change alters a documented
principle, component contract, responsive behavior, or product boundary. Keep
the code and this guide aligned, reuse existing tokens and patterns, and verify
the production build plus the affected desktop and mobile states.
