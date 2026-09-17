# Future plans

This document records deferred product and persistence work. These requirements
do not describe the current static opportunity catalogue.

## Opportunity persistence

When opportunities move into PostgreSQL, create the table with the current
application model from the outset. Its category and flexible-tag columns must
be:

```sql
category text[] not null,
tags text[] null
```

`category` contains one or more supported opportunity categories. `tags`
contains flexible display labels. Tag values must be trimmed, non-empty,
non-null, and unique within an opportunity using case-insensitive comparison.
Store `null` when an opportunity has no flexible tags.

The opportunities table does not currently exist, so this work must create the
columns directly rather than rename or alter an earlier `tags` column.

## Opportunity administration

Add opportunity management to the administrator panel after persistence is in
place. The editor must provide a dedicated **Invite-only** toggle. Enabling it
adds the canonical `Invite-only` tag and disabling it removes that tag, without
requiring the administrator to type its value.

The editor must separately let administrators create, assign, and remove other
free-form tags. It must trim tag text, reject empty values, collapse
case-insensitive duplicates, and send `null` when no tags remain.
