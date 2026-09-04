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
