# Future plans

This document records deferred product work. The public catalogue still uses
static prototype data, while its PostgreSQL persistence schema is available.

## Opportunity persistence

Migration `0003_shared-scraper-schema` creates opportunities, article history,
and website features. Its category and flexible-tag columns are:

```sql
category text[] not null,
tags text[] null
```

`category` contains one or more supported opportunity categories. `tags`
contains flexible display labels. Tag values must be trimmed, non-empty,
non-null, and unique within an opportunity using case-insensitive comparison.
Store `null` when an opportunity has no flexible tags.

Connecting the catalogue to an opportunity API remains deferred. Use the
shared response type, persistence serializer, and frontend summary fallback
when replacing prototype data. Website-feature reads must use the opportunity's
`website_id`, not its jurisdiction or publishing organisation. Do not import the
prototype records unchanged: they reuse website homepages as source URLs, while
persisted opportunities require one unique canonical consultation URL each.

The external scraper must adopt the required website reference and transaction
protocol described in [Scraper database integration](scraper-database.md).

## Opportunity administration

Add opportunity management to the administrator panel after persistence is in
place. The editor must provide a dedicated **Invite-only** toggle. Enabling it
adds the canonical `Invite-only` tag and disabling it removes that tag, without
requiring the administrator to type its value.

The editor must separately let administrators create, assign, and remove other
free-form tags. It must trim tag text, reject empty values, collapse
case-insensitive duplicates, and send `null` when no tags remain.
