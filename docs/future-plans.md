# Future plans

This document records deferred product work. The public catalogue and detail
pages now read PostgreSQL through their opportunity APIs. Development fixtures
are installed explicitly with `npm run db:seed`; runtime reads use `DATABASE_URL`.

The external scraper must adopt the required website reference and transaction
protocol described in [Scraper database integration](scraper-database.md).

## Opportunity administration

Manual creation, preview, platform selection/creation, the dedicated Invite-only
toggle, and free-form tags are available in the Opportunities admin area.
Editing/deleting published opportunities, persisted unpublished drafts, and
Polygon/MultiPolygon authoring remain deferred.
