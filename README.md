# website

Look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

After installing dependencies, install Chromium for browser tooling:

```bash
npx playwright install chromium
```

This downloads Chromium into Playwright’s browser cache. Backend unit tests do
not use Chromium. End-to-end and browser tests are deferred.


## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Database and administrator setup

The application uses PostgreSQL with Drizzle ORM. Run the following commands
from the project root.

Copy the example environment file:

```bash
cp .env.example .env
```

Update `.env` with the PostgreSQL connection string and a session password:

```dotenv
DATABASE_URL=postgresql://echo:echo@postgres:5432/echo
NUXT_SESSION_PASSWORD=replace-with-a-random-string-at-least-32-characters-long
```

The real `.env` file is ignored by Git. Do not commit database credentials or
the session password.

### Choose a database and run migrations

Except for `db:seed`, database commands display an interactive list of project-root
`.env` and `.env.*` files, excluding `.env.example`. After you choose a file, the command
prints its name and the database URL it will use, with the password replaced by
`***`, before connecting.

The initial migrations are already included in `drizzle/`. Apply them to the
database selected at the prompt:

```bash
npm run db:migrate
```

This creates `users`, `static_pages`, `website_indexes`, `websites`,
`opportunities`, and `article_history`, plus the `user_role` enum and opportunity
validation/deletion functions and triggers. It records the applied migrations
so rerunning the command does not recreate the tables.

When the Drizzle schema changes in the future, generate and review a new
migration before applying it:

```bash
npm run db:generate -- --name=describe-the-change
npm run db:migrate
```

Keep existing migration SQL and snapshots unchanged. Opportunity validation
functions and deletion triggers are maintained explicitly in new migration SQL;
review their ordering as well as the generated tables and constraints.

### Seed the development catalogue

After migrating the devcontainer database (select `.env` above), run:

```bash
npm run db:seed
npm run dev
```

The seed command always connects to `postgres:5432/echo` using the devcontainer's
fixed development credentials. It does not load environment files, show an
environment picker, or use `DATABASE_URL`. Run it inside the devcontainer; it
requires the existing migrations and never runs automatically on application
startup. Its fixtures live in `scripts/seed.sql`; the root `seed.sql` remains the
separate website-index registry seed.

Seeding writes 12 synthetic opportunities, two website-feature records, and
matching scrape histories. Placeholder consultation URLs are unique beneath
the Engage Victoria and DCCEEW indexes. Reruns update matching fixtures, preserve
unrelated records and stable IDs, and skip URLs marked deleted. The entire seed
rolls back if a conflicting ID belongs to another source URL.

The public catalogue and detail pages read PostgreSQL through
`GET /api/opportunities` and `GET /api/opportunities/:id`, including website
features. Application reads use `DATABASE_URL` in development and production;
there is no mock-data fallback when the database is unavailable. Restart the
application after changing its database environment. No new migration is needed
for these reads.

Scraper writers must supply a unique canonical source URL and a `website_id`
referencing `websites.id`. See [Scraper database integration](docs/scraper-database.md)
for the writer protocol, validation responsibilities, and deletion behavior.

### Create an administrator

After applying the migration, run:

```bash
npm run user:create
```

Choose the environment file at the first prompt. The command then prompts for a
username, password, and password confirmation. The
password is visible while entered. Usernames are converted to lowercase and
must contain 3–64 letters, numbers, dots, underscores, or hyphens. Passwords
must be non-empty but have no length or complexity requirements.

The command stores only the password hash and creates the account with the
`admin` role. It reports an error if the username already exists.

### Use production database commands

Create an ignored `.env.production` file containing the production database
connection and session values:

```dotenv
DATABASE_URL=postgresql://production-user:production-password@production-host:5432/production-database
NUXT_SESSION_PASSWORD=replace-with-a-production-secret-at-least-32-characters-long
```

Run the same account command and select `.env.production`:

```bash
npm run user:create
```

This command runs locally but connects to the database configured in
`.env.production`. The production database must already contain the migrated
schema.

### Reset database data

Clear opportunities, article history, website features, website indexes,
administrator accounts, and managed static-page content while keeping the schema
and Drizzle migration history:

```bash
npm run db:reset
```

Clear only About and Resources content while retaining administrator accounts:

```bash
npm run db:reset:pages
```

Both commands show the selected environment file and masked database target.
Development targets reset immediately after selection. Selecting
`.env.production` requires typing the parsed database name exactly; cancelling
or entering anything else leaves the database unchanged. Resets do not recreate
tables or rerun migrations.

The full reset clears opportunities and their history together, intentionally
removing deletion suppression. Ordinary opportunity deletion uses `DELETE` and
retains its history; `TRUNCATE` bypasses the deletion triggers. Never use a reset
as a migration-verification step.

## Dev container

The development container starts the application container and PostgreSQL 18
together using Docker Compose. PostgreSQL is available to the application as
`postgres:5432`, is not exposed on a host port, and stores its data in a named
Docker volume.

Opening or rebuilding the dev container starts PostgreSQL but does not apply
database migrations or create users. Run those commands manually as described
above.

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.

## Administrator login

Use **Login for Admins** after About in the public header, or visit
`/admin/login`. Sign in with an enabled administrator created by the existing
account CLI. Successful login opens `/admin`: Pages links to the About and
Resources editors, Indexes manages website-index records, and Scraper
browses tracked articles grouped by their originating index. Saving sanitized HTML creates
or updates the corresponding `static_pages` row and publishes it immediately.

Until a page has been saved for the first time, its public route shows a
content-is-being-prepared message. The editor instead loads the corresponding
HTML starter document from `app/content/static-pages/*.txt`. A starter document
is unsaved initial editor content: it is neither a database seed nor a public
fallback. **Reload original template** restores that starting content for review,
but only **Save and publish** writes it to PostgreSQL.

The public page derives its “On this page” links in the browser after hydration
from marked headings in the saved HTML. Editors control inclusion, short labels,
and one level of nesting through the navigation panel. Images use HTTPS or
same-site links; this version does not upload files.

Jodit JavaScript is bundled from its public package entry point. Its versioned
4.14.4 stylesheet is loaded on the editor route from jsDelivr with an integrity
check. If the CDN cannot be reached, the editor reports the stylesheet failure
and offers a retry.

See [Writing and publishing ECHO pages](docs/writer.md) for a step-by-step guide
to editing, previewing, navigating, and publishing pages without technical
website experience.

For signed-in administrators, the header instead shows **Go to Admin panel**,
linking directly to `/admin`. The link follows the existing session state after
refresh, login, and logout; signed-out visitors see **Login for Admins**.

Use **Change password** beside your username in the admin header, or visit
`/admin/change-password`, to change your own password. Enter a non-empty new
password and re-type it exactly, including any whitespace. Your current password
is not required. The new password applies to future logins; existing sign-ins
and their expiry remain unchanged. No database migration is needed.

Administrator sessions expire 24 hours after login. Sign in again after expiry; signing out ends the current session immediately.

The session and cookie lifetime is 86,400 seconds. Requests do not extend the
absolute expiry. Protected requests recheck the account’s current role and
disabled status.

Server configuration:

- `DATABASE_URL`: PostgreSQL connection string, loaded from local `.env` by Nuxt or supplied as a runtime environment variable.
- `NUXT_SESSION_PASSWORD`: session encryption password, at least 32 characters.
- `NUXT_CSURF_ENCRYPT_SECRET`: stable CSRF encryption key, exactly 32 ASCII characters (32 bytes, not a 64-character hexadecimal encoding). Configure this for production so Functions instances share the same key. The module supplies a temporary development default when omitted.

Login, logout, and password changes use CSRF tokens through `$csrfFetch`. Protection covers POST,
PUT, PATCH, and DELETE, including the session deletion endpoint. A rejected
token prompts the user to reload and retry. Cookies require HTTPS in production.

Keep secrets in ignored environment files locally and in Netlify environment
variables with Functions scope in production, never in `netlify.toml`.
The CLI’s `.env.production` file is not automatically used by deployed Functions.

## Website index status

The public `/indexes` page lists the source websites ECHO checks and reads their
current Active or Inactive status from `website_indexes`. Internal notes are not
returned by the public API or displayed in the table. If the table is empty or
the database cannot be queried, the page remains available and shows a
retryable **Table under maintenance** message.

Administrators can use the Indexes section at `/admin?tab=indexes` to add,
edit, activate, deactivate, annotate, and stage deletion of website indexes.
Names, HTTPS URLs, statuses, and internal notes are saved together with **Save
all changes**. New IDs are generated by PostgreSQL. The complete batch succeeds
or rolls back as one transaction, and committed changes appear on the public
page immediately.

## Scraper panel

Open **Scraper** at `/admin?tab=scraper`. Select a source to see all
its tracked articles, newest upload date first, and search titles. Searches are
case-insensitive literal substrings. Results have 25 articles per page; the URL
preserves the source, search, and page for browser navigation. Deleted records
and articles without a successful scrape remain visible. Unknown upload dates
sort last. Upload date means first upload, not the latest scraper run.

Unassigned articles have a null `article_history.source_index_id`. Their original
article URLs remain available. Deleting an index retains its articles under
Unassigned articles. Article browsing links to the original articles and any
existing public opportunity.

Migration `0006_article-history-source-index` adds the nullable source foreign
key and backfills only unambiguous, most-specific index URL prefixes. Apply it
with `npm run db:migrate` before updating scraper writers to supply the originating
index ID. Ambiguous or unmatched legacy URLs remain unassigned. All admin APIs
require an enabled administrator and use private, no-store responses.

The separate root `seed.sql` populates the source registry. Running
`npm run db:seed` after that registry is present associates synthetic articles
with its Engage Victoria and DCCEEW entries. Without those entries the catalogue
seed still succeeds and its articles appear as unassigned. Seeding preserves
known source associations and does not create or modify registry entries.

On the source overview, each **Enabled for scraping** switch edits a draft.
**Disable all** stages a master pause: every source card turns grey and its
switch is disabled, while each switch keeps its individual on/off position.
**Enable all** removes the pause and resumes the individual choices; it does not
turn previously unselected sources on. **Save changes** applies the effective
flags to `website_indexes.active` (all false while paused). The retained choices
and pause display are stored per administrator in this browser, so saving a
pause and refreshing keeps the switch positions. Actual database changes made
elsewhere take precedence over stale browser state. Article links remain usable.
No schema migration is needed for these controls.

Before the first bulk action, the panel backs up the current visible choices,
including unsaved edits. The versioned backup stays in this browser's
`localStorage`, scoped to your administrator account, through refreshes, browser
restarts, repeated bulk actions, and saves. **Restore previous settings** loads
matching source IDs and URLs into the draft; it still requires **Save changes**.
Removed or changed sources are skipped and new sources retain their choices.
**Replace saved settings** deliberately replaces the backup with the current
visible choices. If browser storage is unavailable, bulk changes are blocked
until a backup can be stored; individual source switches remain usable.

A conflicting save applies nothing and keeps your choices and backup. Reload
sources to resolve it. Leaving the panel or switching admin tabs warns about
unsaved source settings. Indexes reads the same flags; stale Indexes edits also
receive a conflict instead of overwriting a Scraper change.

The external scraper must select `website_indexes` rows where `active = TRUE`
when choosing sources. Disabling affects subsequent source selection; it does
not cancel a running scrape or remove previously scraped articles.

## Backend unit tests

`npm run test:unit` runs the Vitest suite once; `npm run test:unit:watch` runs it
in watch mode. Tests exercise authentication services, application-owned Nitro
handlers, static-page sanitization and persistence, client-side section
navigation, starter documents, and the logout wrapper in process.
Database and framework session boundaries are mocked; password verification uses
the real Scrypt implementation. Coverage includes account eligibility, sanitized
errors, fixed 24-hour expiry, static content safety, and waiting for successful
deletion before refreshing local session state. Happy DOM covers client-side
navigation without launching a browser. No environment files, PostgreSQL, Nuxt
server, or browser are required. Real CSRF middleware and Nuxt authentication
module integration coverage are deferred. No end-to-end or browser tests are
included.

Run `npm run build` after application or configuration changes.

## PostgreSQL migration tests

Run the separate database suite with:

```bash
npm run test:database
```

Select an environment file as with other database commands. Its PostgreSQL role
must have `CREATEDB`. The suite creates randomly named disposable databases on
that server, tests fresh migrations and upgrades from earlier schemas (including
`0005`), and drops only those databases afterward. It does not migrate, reset,
or copy data from the selected database. Prefer a development server. If a run is forcibly interrupted,
its `echo_*_test_*` databases may need manual cleanup.

Coverage includes URL uniqueness, website features, array/date constraints,
deletion suppression, hash retention, transaction rollback, response mapping,
source backfilling, title search, article pagination, and seed source associations.
`npm run test:unit` remains independent of PostgreSQL and environment files.
