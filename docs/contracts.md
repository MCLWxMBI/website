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
notes:

~~~ts
interface AdminWebsiteIndex extends WebsiteIndexResponse {
  notes: string | null
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

`GET /api/opportunities/:id` returns:

~~~ts
interface OpportunityDetailResponse {
  opportunity: OpportunityResponse
  websiteTags: string[]
}
~~~

Website features come from the referenced `websites` row, not a fixed platform
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
| **website** | Stable source-platform key referencing `websites.id`, stored as `opportunities.website_id`. Used to retrieve website-feature tags; separate from the publishing organisation and opportunity tags. |
| **sourceOrg** | Non-empty name of the publishing organisation running the consultation. Used as the Authority filter value; source websites are separate. The frontend derives unique, alphabetically sorted options from the complete opportunity collection and matches exact names. |
| **jurisdiction** | One of the supported jurisdiction values. Do not return an unrecognised free-text value. |
| **startDate** | ISO 8601 UTC timestamp ending in `Z`, or `null` when no opening time is available. When present, it must not be later than the effective `submissionDeadline` instant (the first day at midnight UTC for month-only deadlines). |
| **submissionDeadline** | An ISO 8601 UTC timestamp ending in `Z`, or a canonical `YYYY-MM` month-only value. Month-only values require years `0001`–`9999` and months `01`–`12`; their effective closing instant is the first day of that month at midnight UTC. |
| **category** | Array containing at least one supported category, without duplicates. |
| **tags** | Flexible display labels, or `null` when the opportunity has none. Values must be trimmed, non-empty, non-null, and unique using case-insensitive comparison. |

Supported categories are:

- Biodiversity & ecosystems
- Climate change
- First Nations & cultural heritage
- Water & resources
- Communities & environment

Unknown category and jurisdiction values should be rejected or mapped by the
API before the response reaches the frontend. Tag values are not restricted to
a predefined list. The canonical `Invite-only` tag identifies opportunities
that require an invitation and drives the catalogue's Access filter.

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

Website details are stored as a website identifier mapped to an array of
display-ready tags. The expected PostgreSQL/Supabase table is:

~~~sql
create table websites (
  id text primary key,
  tags text[] not null
);
~~~

- `id` is the stable website key referenced by opportunities, such as
  `engage-victoria` or `dcceew-consult`.
- `tags` contains the website features shown on the opportunity detail page,
  such as `Login required` or `Online submission`.
- Tags must be non-empty plain-text values. HTML must not be stored in the
  array.

The table and the required `opportunities.website_id` foreign key are included
in migration `0003_shared-scraper-schema`. A website's tags may be an empty
array when it has no features to display; existing values must be trimmed and
unique using case-insensitive comparison. Referenced websites cannot be deleted.
`website_indexes` remains the independent numeric-ID registry of scraper entry
points; its IDs are not website-feature keys.

Persistence uses snake_case columns, while the response uses camelCase, including
`website_id` → `website`. Exact timestamps are serialized in UTC ending in `Z`.
Migration `0004_deadline-precision` adds `submission_deadline_precision`, which is
`datetime` by default, preserving existing rows. A `month` row stores the first
day at midnight UTC in `submission_deadline`, but serializes as `YYYY-MM`; the
precision column is not exposed in the public response.
SQL null tags/start dates remain JSON null; null summary/location fields are
omitted. `serializeOpportunity` provides this mapping and `toOpportunity`
constructs the frontend model with the summary fallback. These helpers are used
by the public catalogue and detail API. Development fixtures are stored in
`scripts/seed.sql` and are inserted only by the explicit devcontainer seed command.
See [Scraper database integration](scraper-database.md) for writer and deletion
requirements.

The backend retrieves the tags for one website using the equivalent of:

~~~sql
select tags from websites where id = $1;
~~~

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
  "website": "engage-victoria",
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
