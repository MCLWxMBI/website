# ECHO API response contract

This document defines the opportunity data the ECHO frontend expects from a
future API. **MUST** identifies data the frontend cannot reliably derive.
**SHOULD** identifies data the API should provide, but for which the frontend
has a deterministic fallback.

The contract describes payload data, not endpoint paths, authentication,
pagination, or transport envelopes.

## Opportunity

~~~ts
interface OpportunityResponse {
  // Required
  id: string
  title: string
  fullText: string[]
  sourceUrl: string
  sourceOrg: string
  jurisdiction: 'Commonwealth' | 'Victoria'
  startDate: string | null
  submissionDeadline: string
  tags: OpportunityCategory[]

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
| **sourceOrg** | Non-empty name of the publishing organisation. |
| **jurisdiction** | One of the supported jurisdiction values. Do not return an unrecognised free-text value. |
| **startDate** | ISO 8601 UTC timestamp ending in `Z`, or `null` when no opening time is available. When present, it must not be later than `submissionDeadline`. |
| **submissionDeadline** | ISO 8601 UTC timestamp ending in `Z`. This is the authoritative instant at which the opportunity closes. |
| **tags** | Array containing at least one supported category, without duplicates. |

Supported categories are:

- Biodiversity & ecosystems
- Climate change
- First Nations & cultural heritage
- Water & resources
- Communities & environment

Unknown category and jurisdiction values should be rejected or mapped by the
API before the response reaches the frontend.

### Fields the API SHOULD return

| Field | API behavior | Frontend fallback |
| --- | --- | --- |
| **summary** | Return a concise plain-text summary suitable for an opportunity card. | Use the first non-empty fullText paragraph, whitespace-normalised and truncated for display. |

When a recommended field is present, the frontend uses the API value. It only
computes a fallback when the field is absent or empty. Status is not part of the
opportunity response; the frontend derives it using the server time contract
below.

Status rules, evaluated in this order, are:

1. At or after `submissionDeadline`: closed.
2. Before a non-null `startDate`: upcoming.
3. Otherwise: open, including when `startDate` is `null`.

Equality at `startDate` means open; equality at `submissionDeadline` means
closed. Comparisons use the UTC instants represented by the timestamps.

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
  "sourceOrg": "Sustainability Victoria",
  "jurisdiction": "Victoria",
  "startDate": "2026-08-17T00:00:00Z",
  "submissionDeadline": "2026-10-23T23:59:59Z",
  "tags": [
    "Communities & environment",
    "Climate change"
  ],
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
