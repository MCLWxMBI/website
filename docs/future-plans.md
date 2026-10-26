# Future plans

This document records deferred product work. The public catalogue and detail
pages now read PostgreSQL through their opportunity APIs. Development fixtures
are installed explicitly with `npm run db:seed`; runtime reads use `DATABASE_URL`.

The external scraper must adopt the required website reference and transaction
protocol described in [Scraper database integration](scraper-database.md).

## Opportunity administration

Add opportunity management to the administrator panel using the existing
persistence schema. The editor must provide a dedicated **Invite-only** toggle.
Enabling it
adds the canonical `Invite-only` tag and disabling it removes that tag, without
requiring the administrator to type its value.

The editor must separately let administrators create, assign, and remove other
free-form tags. It must trim tag text, reject empty values, collapse
case-insensitive duplicates, and send `null` when no tags remain.
