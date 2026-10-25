# Scraper database integration

Drizzle migrations in this repository own the shared database schema. Generate
and review changes with `npm run db:generate -- --name=description`, then apply
them with `npm run db:migrate`, selecting the intended environment file at each
prompt. Do not run the scraper's standalone bootstrap SQL over an existing
database as an upgrade: `CREATE TABLE IF NOT EXISTS` does not reconcile tables.

Migration `0003_shared-scraper-schema` adds opportunities, article history,
website features, validation functions, and deletion triggers. Existing users,
static pages, and website-index records are preserved. The public catalogue and
administration UI do not yet read or edit opportunities in PostgreSQL.

Migration `0004_deadline-precision` adds month-only deadlines without changing
existing timestamps. Existing rows and inserts that omit precision default to
`datetime`. Apply migrations before updating the scraper to write month precision.

## Website identity

Every opportunity writer must provide `website_id`, a stable text key referencing
`websites.id`, such as `engage-victoria`. Create the website metadata before
inserting opportunities. Its `tags text[]` holds feature labels such as
`Login required` and `Online submission`; use an empty array when there are no
features. Values must be trimmed, nonblank, plain text, and unique ignoring case.
Website deletion is restricted while opportunities reference it.

This is an extension to the supplied scraper schema. The external scraper must
add this field to its extraction-to-persistence mapping and coordinate website
metadata with the website owner before writing to the migrated database. This
repository does not contain that scraper implementation.

Website keys identify platforms, not publishing authorities or jurisdictions.
`website_indexes` is a separate registry with numeric IDs for scraper entry
points; do not copy those IDs into `website_id`. API responses expose the text
key as `website`. The repository supports feature lookup by that key without
assuming it is one of the two prototype websites.

## Opportunity identity and writes

- Supply a stable, nonblank opportunity ID suitable for a detail-page URL. Never
  generate a new ID when display content changes.
- Store the canonical HTTPS consultation URL in `source_url`. It is unique:
  one URL identifies one opportunity. Website homepages shared by prototype
  records are not production consultation identities.
- Populate `category text[]` with at least one supported category, and store
  `tags text[]` as null when there are no flexible opportunity tags. Label arrays
  are trimmed, nonblank, and unique ignoring case. `full_text` contains an ordered,
  nonempty array of trimmed plain-text paragraphs; repeated paragraphs are valid.
- Store finite timestamps and ensure a supplied opening time does not exceed the
  effective deadline. For month precision this means the first day at midnight
  UTC, even if the publisher did not give a specific day. Status is derived, never
  stored.
- Validate full HTTPS URL syntax, plain text, canonical `Invite-only` spelling,
  summary length (at most 35 words), and GeoJSON coordinate bounds and ring closure
  in every application writer. Database geometry checks cover only basic shape.

### Deadline mapping

Extract either an exact UTC timestamp ending in `Z`, or `YYYY-MM` when only a
month and year are known. Month values require years `0001`–`9999` and months
`01`–`12`. Normalize publisher-local exact times to UTC before writing.

| Extracted value | `submission_deadline` | `submission_deadline_precision` |
| --- | --- | --- |
| `2026-11` | `2026-11-01T00:00:00Z` | `month` |
| `2026-11-06T17:00:00Z` | `2026-11-06T17:00:00Z` | `datetime` |

The month timestamp is used for sorting and closing status; the precision flag
preserves the month-only display. A month-only November deadline becomes closed
at the start of November. Do not pass a bare `YYYY-MM` directly into PostgreSQL's
timestamp column, or infer month precision from an exact timestamp on day one.

Write both deadline fields together on inserts and whenever updating a deadline,
including in `ON CONFLICT (source_url) DO UPDATE`. Reset precision to `datetime`
when an exact date replaces a month-only value. The database rejects unknown
precision values and month timestamps that are not midnight UTC on the first day.
The existing opening-time constraint applies to the normalized deadline.

TypeScript writers can use `toStoredOpportunityDeadline` from
`shared/utils/opportunity-deadline.ts` to validate and obtain both database
fields. The serializer converts month rows back to `YYYY-MM`. Other scraper
implementations must perform the same mapping; this repository does not contain
the external scraper.

For example, within the history-locking transaction below, with website metadata
already present (use bound parameters for scraped values):

~~~sql
INSERT INTO public.opportunities (
  id, title, full_text, source_url, website_id, source_org, jurisdiction,
  submission_deadline, submission_deadline_precision, category
) VALUES (
  'water-plan', 'Water plan consultation', ARRAY['Feedback on the water plan.'],
  'https://example.gov.au/consultations/water-plan', 'engage-victoria',
  'Publishing authority', 'Victoria',
  '2026-11-01T00:00:00Z', 'month', ARRAY['Water & resources']
)
ON CONFLICT (source_url) DO UPDATE SET
  title = EXCLUDED.title,
  full_text = EXCLUDED.full_text,
  website_id = EXCLUDED.website_id,
  source_org = EXCLUDED.source_org,
  jurisdiction = EXCLUDED.jurisdiction,
  submission_deadline = EXCLUDED.submission_deadline,
  submission_deadline_precision = EXCLUDED.submission_deadline_precision,
  category = EXCLUDED.category;
~~~

This minimal example omits opening time and optional fields; writers supplying
those fields must include them in both the insert and conflict update.

### Transaction lifecycle

For scraper writes, the caller owns the transaction:

1. Ensure the website metadata exists.
2. Insert an `article_history` placeholder for the canonical source URL if absent,
   then lock its row with `SELECT ... FOR UPDATE`. If `deleted` is true, skip it.
3. Upsert the opportunity by `source_url`, retaining the existing opportunity ID.
4. Update the history title and hash in the same transaction, committing only when
   the opportunity was saved successfully. The hash is the lowercase 64-character
   SHA-256 digest of the normalized extraction, not a title hash.

Discovery should skip deleted URLs before extraction. Never clear a deletion
marker as part of an ordinary upsert. Direct inserts create a null-hash history
placeholder; only a successful scraper save supplies a tracked extraction hash.
Use consistent history-first lock ordering, and retry transactions that PostgreSQL
aborts for a deadlock or serialization failure.

## Deletion and deliberate reimport

Delete an opportunity with `DELETE FROM public.opportunities WHERE id = ...`.
The deletion trigger atomically retains `article_history.deleted = true` and
preserves the last successful hash. History has no cascading relationship to
opportunities. The guard trigger rejects inserts and updates using a deleted URL.
Rollback restores both the opportunity and the prior history state.

To deliberately reimport a URL, first ensure the opportunity is absent, then
explicitly delete its history row. The next successful import can create it again.
Treat canonical URL changes as identity changes requiring deliberate handling;
the triggers do not infer URL aliases or redirects.

`TRUNCATE` bypasses row deletion triggers. The full reset command intentionally
clears opportunities and article history together, along with the other app data.
Page-only resets leave all scraper data and deletion suppression intact. Neither
reset is a verification step.

## API preparation and verification

`serializeOpportunity` maps Drizzle records to the shared response type: camelCase
fields, UTC timestamps ending in `Z`, null tags/start dates, and omitted null
summary/location. `toOpportunity` supplies the documented first-paragraph summary
fallback when the response summary is missing or blank, limiting it to 35 words
and adding an ellipsis only when truncated. Status remains frontend-derived.
These helpers do not replace validation of untrusted extraction data.

Run `npm run test:database` against a development server whose role can create
databases. Tests create and drop only their own randomly named databases, covering
fresh migration, upgrade from `0002`, constraints, website lookup, URL upserts,
hash retention, deletion suppression, and rollback. Unit tests cover serialization
and summary fallback without a database. No prototype data is seeded by migration.
