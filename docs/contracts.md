# ECHO API response contract

This document defines the opportunity data the ECHO frontend expects from a
server API. **MUST** identifies data the frontend cannot reliably derive.
**SHOULD** identifies data the API should provide, but for which the frontend
has a deterministic fallback.

The opportunity contract below describes payload data rather than endpoint
paths, authentication, pagination, or transport envelopes. Editable static-page
endpoints are documented separately because their read and write behavior is
part of that contract.

## Editable static pages

About and Resources are stored as sanitized HTML in `static_pages`. Supported
slugs are `about` and `resources`.

`GET /api/pages/:slug` and authenticated `GET /api/admin/pages/:slug` return:

~~~ts
type StaticPageResponse =
  | {
      slug: 'about' | 'resources'
      exists: true
      contentHtml: string
      updatedAt: string
    }
  | {
      slug: 'about' | 'resources'
      exists: false
      contentHtml: null
      updatedAt: null
    }
~~~

Responses are not cached. A missing row produces the public prepared-content
state. Navigation is not part of the response: after hydration, the frontend
finds H1–H3 elements containing `id` and `data-page-nav-label`. An optional
`data-page-nav-parent` names an earlier top-level heading and creates one nested
navigation level. Duplicate or malformed entries are ignored.

`PUT /api/admin/pages/:slug` accepts:

~~~ts
interface UpdateStaticPageRequest {
  contentHtml: string
}
~~~

PUT requires a valid administrator session and CSRF token. It sanitizes the
HTML, requires an H1 and non-empty text, and upserts the row with the current
administrator and timestamp. The successful response is the stored `exists:
true` form above. Saves publish immediately and use last-write-wins behavior.
Unknown slugs return 404, invalid content returns 400, and unavailable storage
returns 503 without database details.

## Administrator password

Authenticated `POST /api/admin/password` accepts:

~~~ts
interface ChangeAdminPasswordRequest {
  newPassword: string
  confirmPassword: string
}
~~~

Both fields must be non-empty strings and match exactly; whitespace is preserved.
The endpoint requires an enabled administrator session and CSRF protection. The
account is taken exclusively from the session. Only its Scrypt password hash is
updated, and success returns `{ success: true }`. Existing sessions and their
expiry remain unchanged. Passwords and hashes are never returned or logged.

Invalid input returns 400, an invalid account or session returns 401, CSRF
rejection returns 403, and hashing or storage failure returns a generic 503.
Responses inherit the admin API's private, no-store caching policy.

## Website indexes

`GET /api/indexes` returns the current public indexing status in
case-insensitive website-name order:

~~~ts
interface WebsiteIndexResponse {
  id: string
  name: string
  indexUrl: string
  active: boolean
}

type WebsiteIndexesResponse = WebsiteIndexResponse[]
~~~

PostgreSQL bigint IDs are serialized as strings. The internal `notes` column is
not selected or returned. Responses use `Cache-Control: no-store`. Database
failures return a generic 503 response; the public page handles that response
locally and remains available with a table-maintenance message. An empty array
uses the same public maintenance state.

Authenticated `GET /api/admin/indexes` returns the same fields plus internal
notes and website feature tags:

~~~ts
interface AdminWebsiteIndex extends WebsiteIndexResponse {
  notes: string | null
  tags: string[]
}
~~~

Authenticated `PUT /api/admin/indexes` accepts a bulk change set:

~~~ts
interface UpdateWebsiteIndexesRequest {
  upserts: Array<{
    id?: string
    name: string
    indexUrl: string
    active: boolean
    notes: string | null
    tags?: string[]
    expectedActive?: boolean // Required for an existing ID.
  }>
  deleteIds: string[]
}
~~~

An omitted ID creates a record using PostgreSQL's `bigserial`; existing IDs are
positive decimal strings. Names are required and limited to 255 characters,
URLs must be absolute HTTPS URLs, and whitespace-only notes become null. The
server rejects duplicate, unknown, or update-and-delete IDs. All changes run in
one transaction and the response is the complete resulting admin collection in
case-insensitive name order. Validation returns 400, stale IDs return 409, and
storage failures return a generic 503. PUT requires administrator authorization
and CSRF protection. Notes never enter the public response.

## Opportunity

`GET /api/opportunities` returns `OpportunityResponse[]`, ordered by effective
deadline ascending and ID ascending. It returns the complete collection; the
frontend applies search, filters and pagination. An empty database returns `[]`.

The homepage accepts optional `deadlineFrom` and `deadlineTo` query parameters
in canonical `YYYY-MM-DD` format (years 0001–9999). Bounds are inclusive UTC
calendar days; the upper bound compares strictly before the next UTC midnight.
Month-only submission deadlines compare as the first day of their month.
Missing bounds are unrestricted. Malformed/repeated values or reversed URL
ranges are ignored as a whole, without changing other filter parameters.
Accepted changes reset pagination to page 1; filtering precedes deadline/ID
sorting and pagination. Invalid form inputs keep the last valid range applied.
The date range is frontend state; API endpoints and database storage are unchanged.

`GET /api/opportunities/:id` returns:

~~~ts
interface OpportunityDetailResponse {
  opportunity: OpportunityResponse
  websiteTags: string[]
}
~~~

Website features come directly from the referenced `website_indexes.tags`, not a fixed platform
list. A missing opportunity returns 404; missing database configuration, storage
failures, or serialization failures return a generic 503. Both endpoints send
`Cache-Control: no-store`. Article history and database credentials are never
included in public responses. Both pages use SSR-compatible data fetching and
never fall back to hardcoded opportunity records.

~~~ts
interface OpportunityResponse {
  // Required
  id: string
  title: string
  fullText: string[]
  sourceUrl: string
  website: string
  sourceOrg: string
  jurisdiction: 'Commonwealth' | 'Victoria'
  startDate: string | null
  submissionDeadline: string // UTC timestamp ending in Z, or YYYY-MM
  category: OpportunityCategory[]
  tags: string[] | null

  // Recommended; computed by the frontend when absent
  summary?: string

  // Optional geographic data
  location?: OpportunityLocation
}
~~~

### Fields the API MUST return

| Field | Requirements |
| --- | --- |
| **id** | Stable, non-empty identifier suitable for use in /opportunities/[id]. It must not change when display content changes. |
| **title** | Non-empty human-readable consultation title. |
| **fullText** | Ordered array of one or more non-empty plain-text paragraphs. HTML must not be returned in this field. |
| **sourceUrl** | Absolute HTTPS URL for the official consultation page. |
| **website** | Decimal string of the bigint `website_indexes.id` referenced by `opportunities.website_id`. Used to retrieve source feature tags. Serialized as a string to preserve bigint precision. |
| **sourceOrg** | Non-empty name of the publishing organisation running the consultation. Used as the Authority filter value; source websites are separate. The frontend derives unique, alphabetically sorted options from the complete opportunity collection and matches exact names. |
| **jurisdiction** | One of the supported jurisdiction values. Do not return an unrecognised free-text value. |
| **startDate** | ISO 8601 UTC timestamp ending in `Z`, or `null` when no opening time is available. When present, it must not be later than the effective `submissionDeadline` instant (the first day at midnight UTC for month-only deadlines). |
| **submissionDeadline** | An ISO 8601 UTC timestamp ending in `Z`, or a canonical `YYYY-MM` month-only value. Month-only values require years `0001`–`9999` and months `01`–`12`; their effective closing instant is the first day of that month at midnight UTC. |
| **category** | Array containing at least one supported category, without duplicates. |
| **tags** | Labels inherited from `website_indexes.tags`, or `null` when the source array is empty. The opportunity has no stored tags column. These shared labels drive search, badges, and Access filtering for all opportunities from that source. |

Supported categories are:

- Biodiversity & ecosystems
- Climate change
- First Nations & cultural heritage
- Water & resources
- Communities & environment

Unknown category and jurisdiction values should be rejected or mapped by the
API before the response reaches the frontend. Tag values are not restricted to
a predefined list. The canonical `Invite-only` tag identifies opportunities
from sources that require an invitation and drives the catalogue's Access filter.

### Fields the API SHOULD return

| Field | API behavior | Frontend fallback |
| --- | --- | --- |
| **summary** | Return a concise plain-text summary, ideally 20–30 words and no more than 35 words, suitable for desktop and mobile opportunity cards. Describe the consultation topic and requested input; avoid repeating the title, publisher or deadline. | Use the first non-empty `fullText` paragraph, whitespace-normalised and truncated to at most 35 words. Append an ellipsis when truncated. |

When a recommended field is present, the frontend uses the API value. It only
computes a fallback when the field is absent or empty. Status is not part of the
opportunity response; the frontend derives it using the server time contract
below.

Status rules, evaluated in this order, are:

1. At or after `submissionDeadline`: closed.
2. Before a non-null `startDate`: upcoming.
3. Otherwise: open, including when `startDate` is `null`.

Equality at `startDate` means open; equality at `submissionDeadline` means
closed. Comparisons use UTC instants. For a month-only deadline such as `2026-11`,
closing occurs at `2026-11-01T00:00:00Z`, not at the end of November.

The catalogue sorts filtered results by effective deadline ascending before
pagination, across all statuses, with opportunity ID ascending as the tie-breaker.
Month-only values display as “Nov 2026” on cards and “November 2026” on detail
pages; exact deadlines and opening dates retain their full-date display.

## Server time

The frontend obtains authoritative current time from `GET /api/time`. The
response is:

~~~ts
interface ServerTimeResponse {
  utcDateTime: string
}
~~~

`utcDateTime` must be a valid ISO 8601 UTC timestamp ending in `Z`. The initial
value is included in the server-rendered Nuxt payload. The client advances that
time locally and periodically resynchronises it with this endpoint.

## Website details database schema

Feature tags are stored directly on the source registry:

~~~sql
-- Relevant columns after migration 0007:
-- website_indexes.id bigint primary key
-- website_indexes.tags text[] not null default '{}'
-- opportunities.website_id bigint not null references website_indexes(id)
~~~

Tags describe website features such as `Login required` and `Online submission`.
Empty arrays are valid. Labels must be trimmed, nonblank, plain text, and unique
ignoring case. The Indexes editor manages these tags; omitted tags in metadata
updates preserve the existing array. New sources default to an empty array.
Sources referenced by opportunities cannot be deleted; admin deletion returns
`409` with `data.reason = 'source_in_use'`. Sources referenced only by history
remain deletable, with history source IDs set to null.

Migration `0007_unify-website-indexes` requires empty `opportunities` and
`websites` tables, verifies that condition under write locks, converts the
foreign key, and removes `websites`. A failed empty-table check rolls back the
migration. Source settings, history records, and deletion triggers are preserved.

Persistence uses snake_case columns, while the response uses camelCase, including
`website_id` → `website`. Exact timestamps are serialized in UTC ending in `Z`.
Migration `0004_deadline-precision` adds `submission_deadline_precision`, which is
`datetime` by default, preserving existing rows. A `month` row stores the first
day at midnight UTC in `submission_deadline`, but serializes as `YYYY-MM`; the
precision column is not exposed in the public response.
Empty source tags and SQL null start dates become JSON null; null summary/location fields are
omitted. `serializeOpportunity` provides this mapping and `toOpportunity`
constructs the frontend model with the summary fallback. These helpers are used
by the public catalogue and detail API. Development fixtures are stored in
`scripts/seed.sql` and are inserted only by the explicit devcontainer seed command.
See [Scraper database integration](scraper-database.md) for writer and deletion
requirements.

The backend retrieves the tags for one website using the equivalent of:

~~~sql
select tags from website_indexes where id = $1;
~~~

Migration `0009_drop-opportunity-tags` removes the opportunity tags column and
its check constraint. Website/source tags are preserved. Both list and detail
responses derive `opportunity.tags` from the joined source; detail `websiteTags`
contains the same values as an array.

## Category catalogue

`categories` stores category names corresponding to the existing opportunity
filters. Each row has a generated integer `id` and a required, unique `name`;
blank names and leading/trailing whitespace are rejected. Migration
`0008_add-categories` creates the table without inserting data.

Both SQL seeds insert Biodiversity & ecosystems, Climate change, First Nations
& cultural heritage, Water & resources, and Communities & environment using
`ON CONFLICT (name) DO NOTHING`. Reruns preserve IDs and additional rows.
Opportunity `category text[]` values, validation, and filter responses retain
their current contract; no new endpoint or category foreign key is introduced.

## Geographic location

Location is optional. Its absence means the opportunity has no usable
geographic representation, and the frontend omits the map section.

When location is present, both label and geometry are required:

~~~ts
type GeoPosition = [longitude: number, latitude: number]

interface OpportunityLocation {
  label: string
  geometry:
    | {
        type: 'Point'
        coordinates: GeoPosition
      }
    | {
        type: 'Polygon'
        coordinates: GeoPosition[][]
      }
    | {
        type: 'MultiPolygon'
        coordinates: GeoPosition[][][]
      }
}
~~~

- Coordinates follow GeoJSON order: longitude first, latitude second.
- Longitude must be between -180 and 180; latitude must be between -90 and 90.
- Polygon rings must contain at least four positions and be closed by repeating
  the first position as the last position.
- For Polygon coordinates, the first ring is the outer boundary and subsequent
  rings are holes.
- Label must be a non-empty, human-readable place or area name. The frontend
  does not reverse-geocode geometry to create it.
- Geometry is authoritative API data. The frontend displays it but does not
  simplify, repair, or calculate boundaries.

## Example response

~~~json
{
  "id": "circular-economy-regulations",
  "title": "Circular economy regulations for priority materials",
  "summary": "Provide feedback on proposed product stewardship requirements.",
  "fullText": [
    "Sustainability Victoria is seeking input on stewardship obligations and recovery targets."
  ],
  "sourceUrl": "https://engage.vic.gov.au/",
  "website": "25",
  "sourceOrg": "Sustainability Victoria",
  "jurisdiction": "Victoria",
  "startDate": "2026-08-17T00:00:00Z",
  "submissionDeadline": "2026-10-23T23:59:59Z",
  "category": [
    "Communities & environment",
    "Climate change"
  ],
  "tags": null,
  "location": {
    "label": "Melbourne, Victoria",
    "geometry": {
      "type": "Point",
      "coordinates": [144.9631, -37.8136]
    }
  }
}
~~~

## Error handling

- Responses missing a MUST field or containing an invalid required value are
  contract violations and must not be silently presented as complete records.
- A list response may omit or flag an invalid record while preserving valid
  records; a detail response for an invalid record should show the standard
  unavailable/error state.
- Missing SHOULD fields are not errors because the documented frontend
  fallbacks apply.
- Missing location is not an error and must not produce an empty map.

## Admin scraper (private)

All routes require an enabled administrator. Responses use `Cache-Control:
private, no-store`; scrape history is never returned by public catalogue APIs.

- `GET /api/admin/scraper/sources` returns
  `{ sources: AdminScraperSource[], unassignedCount: number }`. Each source
  contains `id` (decimal string), `name`, `indexUrl`, `active`, and
  `articleCount`. Sources include empty and inactive entries, ordered by name
  ignoring case, then ID. Unassigned history has a null originating index ID.
- `PATCH /api/admin/scraper/sources` accepts
  `{ updates: [{ id, active, expectedActive }] }` and returns the refreshed
  `AdminScraperSourcesResponse`. IDs are unique positive bigint decimal strings;
  both flags must be booleans. Only changed sources need to be sent, and an empty
  update list is allowed. Only existing `website_indexes.active` values are
  updated. A transaction locks affected rows in ID order and checks every loaded
  flag before writing any changes. Missing rows or changed flags return `409`
  with no partial writes. Invalid input returns `400`; database failures return
  a generic `503`. Writes require the existing CSRF token and administrator
  authorization. Browser snapshots never leave the browser or enter this API.
- `GET /api/admin/scraper/articles?source=<index-id|unassigned>&q=<title>&page=<number>`
  returns `{ items, total, page, pageSize: 25 }`. Search is an optional literal,
  case-insensitive title substring of at most 200 characters. Page is a positive
  safe integer, defaults to 1, and is clamped to the final page after filtering.
  Items are ordered by `uploadDate` descending, null dates last, then
  `sourceUrl` ascending, before pagination.
- Each article contains `sourceUrl`, `title`, nullable `uploadDate` in
  `YYYY-MM-DD` format, `deleted`, `hasSuccessfulScrape`, and nullable
  `opportunityId`. A successful scrape means a stored non-null hash; hashes
  themselves remain internal. Deleted takes precedence in the displayed status.
- Empty lists succeed. Unknown numeric source IDs return 404, malformed query
  values return 400, and configuration/database failures return a generic 503.
  Existing authentication errors continue to apply.

These endpoints use `DATABASE_URL`; article reads remain read-only. The public
opportunity contract is unchanged. Shared types are in `shared/types/admin-scraper.ts`.

Existing-row upserts to `PUT /api/admin/indexes` must also include a boolean
`expectedActive` alongside `id`. The editor sends its last loaded flag; stale
flags return `409` and roll back the batch. New rows omit `expectedActive`.

The Scraper master pause is a browser-side draft mode. Saving it sends effective
`active: false` flags while preserving individual switch choices locally. Resume
sends those retained choices. The API and schema contain no separate global flag.

## Admin opportunity creation

All creation routes require an enabled administrator and inherit private,
no-store caching. Writes also require the existing CSRF token.

- `GET /api/admin/opportunities/options` returns
  `{ sources: [{ id: string, name: string, indexUrl: string, active: boolean, websiteTags: string[] }] }`.
  Sources include inactive records, ordered by name ignoring case then numeric
  ID. An empty registry returns `{ sources: [] }`; this read creates no records.
- `POST /api/admin/opportunities` accepts the public opportunity fields except
  `id`, `website`, and `sourceOrg`. Instead supply `organisation` as either
  `{ existingId: string }` (positive bigint decimal ID) or
  `{ newSource: { name: string, indexUrl: string } }`.
  The server derives the stored publishing organisation from the source record.
  Optional `location` accepts a label and Point geometry in
  `[longitude, latitude]` order. Client IDs and storage-only fields are rejected.
- Successful publication returns `201` with the existing
  `{ opportunity: OpportunityResponse, websiteTags: string[] }` envelope.
  Public catalogue and detail response shapes are unchanged.
- A new organisation requires a trimmed, nonblank plain-text name of at most
  255 characters and an absolute HTTPS index URL, following Indexes validation.
  It is created with `active=false` and null notes. Names alone do not link or
  merge sources. Existing source names, flags, and notes are preserved.
- Title, paragraphs, and labels must be nonblank plain text. Categories and
  jurisdiction use shared controlled values. Labels are trimmed and deduplicated
  ignoring case; `Invite-only` uses canonical spelling. Optional request `tags`
  updates the selected source’s `website_indexes.tags`; omit it to preserve the
  existing array, or supply null/[] to clear it. These edits affect all linked
  opportunities and are committed with publication. Blank summary is omitted;
  supplied summary has at most 35 words.
- The official URL must be HTTPS without credentials. URL parsing normalizes
  the hostname/default port and removes fragments while retaining path and query.
  Deadlines follow the existing UTC timestamp or month-only contract; opening
  cannot exceed the effective deadline. Coordinates must be finite and bounded.
- Validation returns `400` with `data.fieldErrors`. Duplicate or deleted
  consultation URLs, missing selected sources, and conflicting existing history
  source associations return `409`. Duplicate listings also return
  `data.opportunityId`. Database/configuration failures return generic `503`.

Creation is atomic, locking the selected source then following history-first
identity locking. It never upserts existing listings. Source tag edits are
committed atomically with creation and roll back if publication fails.
History links to the selected or newly created source through
`article_history.source_index_id`; an existing null association is filled.
New history uses the current UTC upload date, null hash, and false deletion
marker. Existing history dates and hashes are preserved; its title is refreshed.
Deleted history prevents creation. Failed publication rolls back all new records.

The backend stores the selected source ID directly in `opportunities.website_id`.
Creation options and public detail responses read `website_indexes.tags` directly.
New sources receive the requested tags, defaulting to an empty array. The
creation form preloads existing source tags, including its Invite-only toggle.
Browser preview performs no writes.

Shared creation types are in `shared/types/admin-opportunity.ts`. This feature
requires migration 0009 and adds no persisted draft state or public write endpoint.
