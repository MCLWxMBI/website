# Project commands

Use npm for this repository. Run commands from the repository root.
Keep `package-lock.json` synchronized whenever dependencies change.

| Command | Purpose |
| --- | --- |
| `npm install` | Install dependencies and update `package-lock.json` when needed. |
| `npx playwright install chromium` | Download Chromium to Playwright's browser cache after dependency installation. Not required by backend unit tests. |
| `npm run test:unit` | Run Vitest tests once, in process, without a database, environment files, application server, or browser. Static-page navigation tests use Happy DOM. |
| `npm run test:unit:watch` | Watch and rerun the Vitest suite. |
| `npm run dev` | Start Nuxt with local Netlify platform emulation provided by `@netlify/nuxt`. |
| `npm run build` | Create the production Netlify Functions build and the `dist` publish directory. |
| `npm run generate` | Generate a pre-rendered build when static output is required. |
| `npm run db:generate -- --name=description` | Select an environment file, print its masked database URL, and generate migration SQL and metadata. |
| `npm run db:migrate` | Select an environment file, print its masked database URL, and apply pending migrations to that database. |
| `npm run user:create` | Select an environment file, print its masked database URL, and create an administrator in that database. |
| `npm run db:reset` | Select a database, erase all rows from `website_indexes`, `users`, and `static_pages`, and restart identities while retaining schema and migration history. |
| `npm run db:reset:pages` | Select a database and erase all rows from `static_pages` while retaining users. |

Generated `.nuxt`, `.output`, `dist`, and `.netlify` files are build
artifacts and must not be committed. Production and deploy-preview releases are
created by Netlify from the connected Git repository; there is no local deploy
command. Runtime secrets belong in Netlify with Functions scope and must not be
written to `netlify.toml`.

Database commands discover project-root `.env` and `.env.*` files except
`.env.example`, then require an interactive selection. They print the selected
filename and URL with its password masked before connecting. Reset commands run
without another prompt for development files. Selecting `.env.production` for
a reset requires typing the database name exactly. Never run a reset as a
verification step.

Before handing off application-code or configuration changes, run the smallest
relevant checks and always run `npm run build`. Report any required check that
could not be run and explain why.
