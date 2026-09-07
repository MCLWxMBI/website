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

### Create the database table

The initial migration is already included in `drizzle/`. Apply it to the
database configured by `DATABASE_URL`:

```bash
npm run db:migrate
```

This creates the `users` table and the `user_role` enum. It also records the
applied migration so rerunning the command does not recreate the table.

When the Drizzle schema changes in the future, generate and review a new
migration before applying it:

```bash
npm run db:generate -- --name=describe-the-change
npm run db:migrate
```

### Create an administrator

After applying the migration, run:

```bash
npm run user:create
```

The command prompts for a username, password, and password confirmation. The
password is visible while entered. Usernames are converted to lowercase and
must contain 3–64 letters, numbers, dots, underscores, or hyphens. Passwords
must be non-empty but have no length or complexity requirements.

The command stores only the password hash and creates the account with the
`admin` role. It reports an error if the username already exists.

### Create an administrator in production

Create an ignored `.env.production` file containing the production database
connection and session values:

```dotenv
DATABASE_URL=postgresql://production-user:production-password@production-host:5432/production-database
NUXT_SESSION_PASSWORD=replace-with-a-production-secret-at-least-32-characters-long
```

Run the production variant of the same account command:

```bash
npm run user:create:production
```

This command runs locally but connects to the database configured in
`.env.production`. The production database must already contain the migrated
schema.

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
account CLI. Successful login opens `/admin`: Pages links to About and
Resources, while Submissions previews future consultation-listing management.
Editing and data persistence are not implemented yet.

For signed-in administrators, the header instead shows **Go to Admin panel**,
linking directly to `/admin`. The link follows the existing session state after
refresh, login, and logout; signed-out visitors see **Login for Admins**.

Administrator sessions expire 24 hours after login. Sign in again after expiry; signing out ends the current session immediately.

The session and cookie lifetime is 86,400 seconds. Requests do not extend the
absolute expiry. Protected requests recheck the account’s current role and
disabled status.

Server configuration:

- `DATABASE_URL`: PostgreSQL connection string, loaded from local `.env` by Nuxt or supplied as a runtime environment variable.
- `NUXT_SESSION_PASSWORD`: session encryption password, at least 32 characters.
- `NUXT_CSURF_ENCRYPT_SECRET`: stable CSRF encryption key, exactly 32 ASCII characters (32 bytes, not a 64-character hexadecimal encoding). Configure this for production so Functions instances share the same key. The module supplies a temporary development default when omitted.

Keep secrets in ignored environment files locally and in Netlify environment
variables with Functions scope in production, never in `netlify.toml`.
The CLI’s `.env.production` file is not automatically used by deployed Functions.

Login and logout use CSRF tokens through `$csrfFetch`. Protection covers POST,
PUT, PATCH, and DELETE, including the session deletion endpoint. A rejected
token prompts the user to reload and retry. Cookies require HTTPS in production.

## Backend unit tests

`npm run test:unit` runs the Vitest Node suite once;
`npm run test:unit:watch` runs it in watch mode. Tests exercise authentication
services, application-owned Nitro handlers, and the logout wrapper in process.
Database and framework session boundaries are mocked; password verification uses
the real Scrypt implementation. Coverage includes account eligibility, sanitized
errors, fixed 24-hour expiry, and waiting for successful deletion before refreshing
local session state. No environment files, PostgreSQL, Nuxt server, or browser are
required. Real CSRF middleware and Nuxt authentication module integration coverage
are deferred. No end-to-end or browser tests are included.

Run `npm run build` after application or configuration changes.
