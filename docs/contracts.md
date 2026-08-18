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
  openDate: string
  closeDate: string
  tags: OpportunityCategory[]

  // Recommended; computed by the frontend when absent
  summary?: string
  status?: 'open' | 'upcoming' | 'closed'

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
| **openDate** | Calendar date in YYYY-MM-DD format. |
| **closeDate** | Calendar date in YYYY-MM-DD format and not earlier than openDate. |
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
| **status** | Return the authoritative current status when the source has explicitly changed or extended an opportunity. | Derive the status from openDate, closeDate, and the current Australian calendar date. |

When a recommended field is present, the frontend uses the API value. It only
computes a fallback when the field is absent or empty.

Status fallback rules are:

1. Before openDate: upcoming.
2. From openDate through closeDate, inclusive: open.
3. After closeDate: closed.

Date-only values must be compared as Australian calendar dates, not parsed as
UTC instants that can shift the displayed day.

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
  "openDate": "2026-08-17",
  "closeDate": "2026-10-23",
  "tags": [
    "Communities & environment",
    "Climate change"
  ],
  "status": "open",
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
