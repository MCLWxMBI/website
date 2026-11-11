# Scraper-to-website integration

The [scraper repository](https://github.com/MCLWxMBI/scraper) collects and validates
consultations. This website reads the committed records from PostgreSQL and
provides public listings and administrator views. **PostgreSQL is the integration
point:** the scraper writes directly to it; there is no scraper-to-website HTTP
ingestion endpoint or automatic import of exported text files.

The scraper implementation was reviewed on 11 November 2026 at
[commit `1ce52ccd2723`](https://github.com/MCLWxMBI/scraper/commit/1ce52ccd2723df6a98faa9457847873c3bf5e736).
Descriptions of the workflow below refer to that code, rather than confirming
which migrations or secrets are currently deployed.

```mermaid
flowchart TD
    Admin[Website administrators] --> Config[PostgreSQL: sources, active flags, tags and categories]
    Config --> Scraper[Scraper: discover, extract, check history and validate]
    Sites[Publisher HTML and PDFs] --> Scraper
    Scraper --> Claude[Claude metadata and eligibility extraction]
    Claude --> Save[Validate and commit each opportunity with its history]
    Save --> Records[PostgreSQL: opportunities and article_history]
    Records --> API[Nuxt server APIs]
    API --> Public[Public catalogue, detail pages and maps]
    API --> Articles[Admin Sources and tracked articles]
    Scraper --> Checkpoint[Local run-results.json checkpoint]
    Checkpoint --> Upload[Actions final upload step]
    Upload --> Runs[PostgreSQL: scraper_runs]
    Runs --> RunAPI[Authenticated Nuxt run APIs]
    RunAPI --> Dashboard[Admin Scraper Runs]
```

## Schema ownership and deployment

**All application database schema creation and changes must be done from this
website repository, never from the scraper or any other repository.** This
includes development and production tables, columns, types, constraints, indexes,
sequences, database functions, and triggers.

The authoritative definitions are [server/database/schema.ts](../server/database/schema.ts)
and the reviewed migration history in [drizzle/](../drizzle/). Update them here,
generate and review a new migration, and apply it from this checkout:

```bash
npm run db:generate -- --name=describe-the-change
npm run db:migrate
```

Each command asks which project-root environment file to use. Review the masked
database target before proceeding. Preserve already-applied migration files and
snapshots; put subsequent changes in new migrations. Review SQL functions and
triggers explicitly as well as the generated table definitions. Existing
migrations are applied with `db:migrate`; generating a migration is for changing
the schema, not for ordinary application startup.

Deploy required website migrations before enabling scraper code that depends on
them. Update scraper models and SQL statements to consume the website-owned
contract. Normal scraper and website runtime operations read/write data without
creating or upgrading schema objects.

The reviewed scraper still contains `setup-db`, `sql/schema.sql`, and its own
`sql/migrations/`. Their presence does not make them authoritative. Do not use
those commands or files to provision or upgrade ECHO databases. Reconciling those
copies is a separate scraper change; this document does not change that repository.

## Database targets and development data

The website server uses its `DATABASE_URL`. The scraper uses its own
`DATABASE_URL`, supplied by its environment or repository-root `.env`. For records
to reach the website, both must target the **same logical PostgreSQL database**;
they may use different database roles. A successful scrape into another database
will not update this website.

The website devcontainer defaults to database `echo`; the scraper's documented
Compose example uses database `scraper`. A hostname such as `postgres` refers to
the service reachable from that container, not automatically to the other
project's database. Configure the connection and container network explicitly
when testing the integration locally. Production runners need the production
host and its required TLS parameters, not a Compose-only hostname.

After applying website migrations to the devcontainer, `npm run db:seed` adds the
synthetic opportunities, history, source features, categories, and six run-log
examples from [scripts/seed.sql](../scripts/seed.sql). This command always targets
`postgresql://echo:echo@postgres:5432/echo`, ignores `DATABASE_URL`, and never runs
at application startup. The root [seed.sql](../seed.sql) is the separate source
registry/category seed. Development fixtures are not evidence of an actual
network scrape; do not substitute them for production data.

## Tables and responsibilities

| Table | Role in the integration |
| --- | --- |
| `website_indexes` | Website-managed source IDs, names, entry URLs, `active` flags, notes, and source-wide `tags`. The scraper selects active sources and retains their IDs. |
| `categories` | Category choices read by the scraper before Claude processing. Website validation and filter choices must also support those names. |
| `opportunities` | Current public listings. The scraper writes validated content; administrators can also create listings through the website. |
| `article_history` | Canonical URL identity, last successful input hash, deletion suppression, first-upload date, and originating source association. It survives opportunity deletion. |
| `scraper_runs` | Historical run/source summaries and successfully saved titles. The website displays them without changing them. |
| `users`, `static_pages` | Website administration and managed page content; the scraper does not use these tables. |

`opportunities.website_id` references `website_indexes.id`; there is no separate
`websites` table. `article_history.source_index_id` references the same registry
but can be null when the origin is unknown. Existing known history associations
are preserved. `source_org` is the publishing organisation's display name and
can differ from the portal/index name; it is not a foreign key.

Tags come from `website_indexes.tags`, including `Invite-only`. There is no
`opportunities.tags` column. An administrator's source-tag change affects all
linked opportunities on subsequent website reads. Categories and source tags
serve different purposes and are not interchangeable.

## Collection and persistence

1. **Select sources and categories.** Live collection reads
   `website_indexes WHERE active = TRUE`, ordered by name ignoring case and then
   ID. It loads category names before starting Claude. Source switches saved in
   Scraper or Indexes affect the next source selection; disabling a source does
   not cancel already-selected work or remove its listings. Empty active-source
   results finish without starting a browser or Claude. Category lookup failures
   or empty choices stop processing when work is selected.
2. **Discover and prepare articles.** The scraper discovers consultation URLs,
   canonicalizes their identities, checks history, and extracts HTML/PDF text.
   Deleted URLs are skipped before article-body processing. Remaining extracted
   text is compared with its last successful hash; unchanged articles normally
   skip Claude. Development limits apply after discovery, so discovered counts
   can exceed processed plus skipped counts.
3. **Extract and validate.** Eligible new/changed articles receive at most one
   Claude call per attempt. Claude returns metadata, minimally cleaned ordered
   paragraphs, a summary, one configured category, timing, and geographic evidence.
   Python validates the result and resolves supported geography using verified
   geographic data, rather than accepting invented coordinates. Invalid articles
   and technical failures are recorded separately; neither advances successful
   history. A later run can try again.
4. **Commit one opportunity.** The current writer opens a transaction, upserts
   history first to acquire the URL identity lock, rejects a deletion marker, then
   inserts or updates the opportunity. The selected index ID supplies
   `opportunities.website_id` and the initial history source association. Content,
   successful hash, and initial upload metadata commit together; failures roll
   them back. Normal collection uses an autocommit connection around each such
   transaction, so later failures do not undo earlier saved opportunities.

A later rejection or failed attempt does not delete a previously saved listing.
Existing rows remain until successfully updated or deliberately removed; the
website can therefore still show older listings whose deadlines have passed.

The history hash is SHA-256 of the normalized **article text supplied to Claude**:
line endings become LF and outer whitespace is stripped. It is not a title hash,
a hash of generated opportunity JSON, or a hash of the entire metadata request.
Retained navigation text can therefore affect change detection. The website's
synthetic seed hashes identify its fixtures and are not real scraper input hashes.
See the scraper's
[identity implementation](https://github.com/MCLWxMBI/scraper/blob/1ce52ccd2723df6a98faa9457847873c3bf5e736/scraper/identity.py)
and [transactional writer](https://github.com/MCLWxMBI/scraper/blob/1ce52ccd2723df6a98faa9457847873c3bf5e736/scraper/db/opportunities.py).

Canonical `source_url` is unique. The current scraper derives an ID from that URL
and uses `ON CONFLICT (id)`, updating only when the stored source URL matches.
A different URL with the same slug is rejected. A pre-existing URL with a
different ID is also a conflict, not an automatic adoption of that ID. This
matters for manually published website listings, whose IDs are generated UUIDs.
Coordinate identity handling before expecting the scraper to update such a
listing; do not silently replace it or weaken database constraints elsewhere.

Ordinary opportunity deletion triggers persistent `article_history.deleted=true`.
Early history checks and guarded writes prevent ordinary collection from
recreating it, including when deletion races with extraction. Deliberate reimport
requires removing the matching history entry after the opportunity is absent.
`TRUNCATE` bypasses row deletion triggers and is not the way to remove a single
published listing. Detailed writer/deletion rules are in
[scraper-database.md](scraper-database.md).

## Dates, content, and website serialization

| Scraper/storage value | Website response and behavior |
| --- | --- |
| `website_id` bigint | Public `website` is a decimal string; source tags are loaded through this ID. |
| Exact `submission_deadline` plus precision `datetime` | `submissionDeadline` is a UTC timestamp ending in `Z`. |
| First-day UTC `submission_deadline` plus precision `month` | `submissionDeadline` is `YYYY-MM`, displayed without an invented day. |
| `start_date` timestamp or null | `startDate` is a UTC timestamp or null. |
| `full_text` ordered text array | `fullText` retains paragraph order. A missing summary gets the documented frontend fallback. |
| Optional `summary` / `location` | Null values are omitted from the public response. Valid stored geometry drives the detail-page map. |
| History upload date | Admin articles display the stored date-only value; it is not an opportunity deadline or a last-scraped timestamp. |

Month-only deadlines normalize to the first day at `00:00:00Z`. Both deadline
columns must be written together. The website uses that instant for closing,
sorting, and date filtering: `2027-09` becomes closed at the start of September,
not the end. Opening timestamps must not exceed the effective deadline. The
reviewed scraper model enforces that ordering, even though some scraper README
wording describes month deadlines more broadly.

Exact publisher-local times must be converted to UTC using the applicable
timezone and daylight saving. The current scraper uses local end-of-day for a
date-only closing and local midnight for a date-only opening when the timezone
is known. These rules do not change the separate first-day rule for month-only
deadlines.

The scraper explicitly supplies its first-upload date using the
Australia/Sydney calendar date. The website schema still permits null historical
upload dates and defaults omitted dates to the current UTC date. Preserve stored
dates on updates and display them as dates; do not timezone-shift them as if they
were instants. A schema-policy change here must be migrated from this repository.

## Reading the results on the website

Nuxt server repositories connect lazily using `DATABASE_URL`. Browser components
fetch server APIs; database credentials remain server-side. Successful database
writes become available on the next relevant fetch/refresh without a website
rebuild, file import, or webhook. Public catalogue pages do not poll for new data.

| Endpoint / view | Data shown |
| --- | --- |
| `GET /api/opportunities` | Complete current collection joined to source tags, ordered by effective deadline and ID. |
| `GET /api/opportunities/:id` | Independent detail read, including source features and map data. |
| `GET /api/indexes` | Current source registry and enabled flags; no internal notes. |
| Admin Scraper → Sources | Source controls and tracked article history, including deleted/unassigned records. |
| `GET /api/admin/scraper/runs` and `/:id` | Paginated run summaries and complete historical source/title snapshots. |
| Admin Opportunities → Export | All current opportunities as XLSX, independently of catalogue filters. |

The public homepage derives status using server-synchronized time, then filters,
groups Upcoming → Open → Closed, sorts deadlines ascending within each group
(ID breaks ties), and paginates 12 results. Upcoming is unchecked by default, so
the initial view shows Open → Closed. Month-only date comparisons use the first
day in UTC. A record can exist in PostgreSQL but be outside the viewer's current
search, status, access, authority, or date filters.

History is not a list of every discovered URL. Invalid/new failed attempts may
have no history row. The admin's tracked-article list therefore differs from a
run's discovered/invalid/failed counts. Website manual publication and database
triggers can create history with a null hash; that alone does not prove a
successful scraper extraction. Public responses do not expose history hashes
or run errors. See [contracts.md](contracts.md) for response formats and failures.

## Scheduled collection and run-log visibility

The reviewed
[Actions workflow](https://github.com/MCLWxMBI/scraper/blob/1ce52ccd2723df6a98faa9457847873c3bf5e736/.github/workflows/scraper.yml)
runs daily at 14:00 UTC and supports manual dispatch on the default branch. Its
production concurrency group avoids overlapping workflow invocations without
cancelling the active one. The runner supplies the production database secret,
Claude model, and Anthropic OIDC configuration. Local collection can instead
use an API key. The website requires none of those Claude credentials.

Opportunity saves and run-log uploads are separate operations:

1. Actions enables a local `output/logs/run-results.json` checkpoint. The
   [pipeline](https://github.com/MCLWxMBI/scraper/blob/1ce52ccd2723df6a98faa9457847873c3bf5e736/scraper/pipeline.py)
   updates source results and titles there during collection; titles are added
   after successful database/file saves.
2. After collection, an `if: always()` step invokes
   [scraper.upload_run_log](https://github.com/MCLWxMBI/scraper/blob/1ce52ccd2723df6a98faa9457847873c3bf5e736/scraper/upload_run_log.py)
   using a separate database connection. It inserts the completed or partial
   snapshot into the fixed six-column `scraper_runs` table. Missing/invalid
   checkpoints can produce a minimal failed/interrupted summary when this step
   can execute. Connection establishment is retried; inserts/commits are not,
   because repeating an uncertain insert could duplicate a run.
3. Console output, article-decision JSONL, and the checkpoint are retained as
   Actions artifacts when available. If upload or the surrounding workflow
   cannot complete, the dashboard may have no row even though opportunities
   were already saved. Inspect Actions and its artifacts separately.

**The current Actions workflow does not insert a database run row at startup or
stream its per-source checkpoints to PostgreSQL.** Admin Runs polls every 15
seconds while visible, but current Actions results usually appear only after
the final upload. That polling does not make local checkpoints visible. The
website can display a database `running` row updated incrementally by another
writer; [scraper-runs.md](scraper-runs.md) describes the supported database
contract. The existing workflow's upload timing is a separate implementation.

Run/source statuses and article counters are distinct. A failed run may retain
successful source results; a source discovery failure can have zero failed
articles. Ordinary invalid articles do not by themselves make a source fail.
Saved titles are display text with duplicates allowed, not linked listings.
Running means the stored last-reported status, not proof of worker liveness.

## Collection modes

| Mode | Public opportunity/history writes | Run visibility |
| --- | --- | --- |
| Default database collection | Each valid record and its successful history commit together. | Actions performs the separate final run upload. Local runs need explicit checkpoint/upload configuration for a database run entry. |
| `--text` / `--txt` | No opportunity/history writes; outputs structured files and raw article text while consulting live sources/history/categories. | A file-save pass is not publication. A separately uploaded run may still describe these results. |
| `--fixtures` | Saved article inputs, real Claude processing, and category reads; no opportunity/history writes. | Outputs stay in files unless a run summary is uploaded separately. Historical fixture source IDs need not identify current registry entries. |
| `python -m scraper discover` | Source discovery only; no Claude or opportunity persistence. | Not the normal collection/run-upload workflow. |

Collection can also write file-only article-decision diagnostics. The website
does not read those files or automatically import text/fixture output. A local
checkpoint is enabled by `--run-results` or `SCRAPER_RESULTS_FILE`; creating that
file does not itself insert `scraper_runs`.

## Compatibility checks before connecting a scraper deployment

The schema ownership rule above takes precedence over setup or migration
instructions still present in another repository. In particular:

- The scraper has duplicate schema/bootstrap SQL. Use this repository's Drizzle
  migrations for provisioning and upgrades, and align consumers with the result.
- The website currently has a fixed five-category database check and TypeScript
  filter/validation vocabulary. The scraper reads `categories` dynamically and
  its own SQL copy has a looser category check. Adding a category row alone does
  not update website validation or filter controls. Coordinate all required
  changes here before allowing the scraper to produce a new category.
- The website allows unknown/null history upload dates with a UTC default;
  the scraper SQL copy declares a required Sydney-date default. The scraper's
  explicit successful-save dates work with the website schema; do not apply the
  other SQL copy to silently replace this policy.
- The website's generic writer examples use source-URL upserts. The current
  scraper uses an ID upsert with a URL guard, so reconcile pre-existing/manual
  identities before relying on automatic updates.
- The supported database run contract allows incremental running rows; the
  reviewed Actions implementation uploads a final snapshot. Observe the actual
  upload timing when diagnosing dashboard freshness.

When troubleshooting missing listings, check the logical database target,
committed save outcome, deletion/hash skips, validation/constraint failures,
identity conflicts, and website filters. When listings appear but run history
does not, check the separate upload step and its database access. Schema
corrections belong in a new migration in this repository, followed by consumer
updates; they are not fixed by running another repository's bootstrap SQL.
