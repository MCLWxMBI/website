# Repository guide

This repository is a Nuxt 4, Vue 3, and TypeScript application deployed with
server-side rendering on Netlify Functions.

## Project map

- `app/` contains the client application, pages, components, styles, and local
  prototype data.
- `docs/design.md` is the canonical product and interface design reference.
- `docs/contracts.md` defines API response requirements and frontend fallbacks.
- `server/` contains Nitro server code and database access.
- `shared/` contains types and utilities used across client and server code.
- `drizzle/` contains generated database migrations and metadata.
- `public/` contains files served unchanged.
- `nuxt.config.ts` configures Nuxt and the Netlify Nitro preset.
- `netlify.toml` defines the Git-based Netlify build and publish settings.
- `package.json` and `package-lock.json` are the canonical dependency files.

The product proposal is retained as source material. Do not generate or commit
converted copies unless the user explicitly requests them.

## Working expectations

- Inspect the relevant implementation and documentation before making changes.
- Preserve unrelated user changes and generated artifacts already present in the
  working tree.
- Keep runtime secrets in ignored environment files locally and in Netlify with
  Functions scope. Never place secrets in `netlify.toml` or committed files.
- Never deploy, generate credentials, or change Netlify resources unless the
  user explicitly requests it.
- Keep product documentation aligned when behavior or public contracts change.
