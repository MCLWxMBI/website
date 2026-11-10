# Scraper run logs

Migration `0010_scraper-runs` creates this fixed table, mirrored by Drizzle:

```sql
CREATE TABLE public.scraper_runs (
    id BIGSERIAL PRIMARY KEY,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'running',
    sources JSONB NOT NULL DEFAULT '[]'::jsonb,
    extracted_opportunities JSONB NOT NULL DEFAULT '[]'::jsonb
);
```

There are no additional columns, checks, indexes, foreign keys, or logging
triggers. The external scraper owns writes. The website exposes authenticated,
read-only run APIs and displays the recorded status without inferring liveness.

## Writer contract

Insert a row at startup. Run status is `running`, `passed`, `failed`, or
`interrupted`. Record both JSON arrays together as each source completes; when
sources process concurrently, coordinate updates so one result cannot overwrite
another. At shutdown, set `finished_at` and the final status. Keep successful
results when other sources fail. A crashed run can remain `running` until the
writer explicitly records `interrupted`.

Each attempted source has one entry in `sources`:

```json
{
  "website_index_id": 36,
  "source_name": "Example source",
  "source_url": "https://example.gov.au/index",
  "status": "passed",
  "discovered_count": 4,
  "processed_count": 2,
  "passed_count": 1,
  "invalid_count": 1,
  "failed_count": 0,
  "skipped_count": 2,
  "error": null
}
```

Source status is `passed`, `failed`, `empty`, or `skipped`. Technical discovery,
extraction, Claude, or save failures make the source failed. Ordinary invalid
articles do not. `processed_count` equals passed plus invalid plus failed;
`skipped_count` counts unchanged/deleted articles. A development limit can leave
discovered candidates unprocessed. A discovery failure can have zero failed
articles. Errors contain safe messages, never credentials or raw database details.

Each source has a matching entry in `extracted_opportunities`:

```json
{
  "website_index_id": 36,
  "source_name": "Example source",
  "titles": ["Successfully saved opportunity title"]
}
```

Add a title only after its save succeeds. File-output runs count successful file
saves. A source with no successes has an empty titles array. Duplicate titles
are allowed; title count equals `passed_count`. These are display titles only,
with no opportunity IDs, article statuses, or article links. Neither logging nor
the read APIs change article-history dates or website-index tags.

IDs in stored JSON may be numbers. The read repository converts each source ID
to text in SQL before JavaScript decodes JSON, preserving full bigint precision.
Runtime validation protects the panel from malformed JSON without adding database
constraints or repairing stored logs.

## Admin view

Open `/admin?tab=scraper&view=runs`. History shows 25 runs per page, filtered by
run status and ordered by start descending, then ID descending. Summary totals
cover the source results recorded so far. Source count means sources reported,
not a total planned-source count or completion percentage.

Select a run for all source results, safe errors, and expandable saved titles.
Filters search historical source names, source statuses, and saved titles. Totals
remain for the whole run. Registry changes do not change historical snapshots.
Times use Australia/Melbourne with daylight saving; API timestamps remain UTC.
Running is the last reported status, and elapsed time is time since startup.

Visible history polls every 15 seconds. Running details poll until their stored
status changes. Hidden browser tabs and unmounted views do not poll. Manual
refresh is available; failures retain last loaded results with an error and Retry.
Source controls remain mounted while browsing Runs, retaining unsaved choices.

## Development fixtures

Apply migrations and run `npm run db:seed`. It targets only
`postgresql://echo:echo@postgres:5432/echo`, ignoring `DATABASE_URL`.
Application reads use `DATABASE_URL`; startup never seeds automatically.

`scripts/seed.sql` adds six snapshots dated November 1–6, 2026:

1. Passed with successful saves and ordinary invalid articles.
2. Failed with successes retained alongside an extraction failure.
3. Failed discovery before article processing.
4. Interrupted with partial completed-source results.
5. Running with no finish time or source results yet.
6. Passed with empty and skipped sources.

Names/IDs/URLs resolve from the development source fixtures, and successful
titles use opportunity fixture values. These are synthetic historical snapshots,
not evidence that the scraper ran. The running example intentionally remains
running. All counters and title lengths obey the contract.

Fixed timestamps and complete payload comparison make unchanged reruns
idempotent; existing runs are never overwritten. BIGSERIAL assigns IDs. The
existing seed transaction/locking serializes seed commands and rolls everything
back on failure. The runner reports `runsSeeded` and `runsSkipped` separately
from opportunity/history counts. Full resets include `scraper_runs`; pages-only
resets preserve it.
