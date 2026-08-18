# Repository agent guide

This repository is a Nuxt 4, Vue 3, and TypeScript application deployed with
server-side rendering on Netlify Functions. These instructions apply to the whole repository and are
intended for any coding agent working in it.

## Project map

- `app/` contains the client application, pages, components, styles, and local prototype data.
- `docs/design.md` is the canonical product and interface design reference.
- `docs/contracts.md` defines future API response requirements and frontend fallbacks.
- `server/` is reserved for Nitro server code.
- `public/` contains files served unchanged.
- `nuxt.config.ts` configures Nuxt and the Netlify Nitro preset.
- `netlify.toml` defines the Git-based Netlify build and publish settings.
- `package.json` and `package-lock.json` are the canonical dependency files.

The product proposal is retained as source material. Do not generate or commit
converted copies of it unless explicitly requested.

## Working expectations

- Inspect relevant code before editing and preserve unrelated user changes.
- Use npm and keep `package-lock.json` in sync when dependencies change.
- Prefer typed Vue components and explicit domain types over untyped objects.
- Keep components focused: pages coordinate data and routing, while reusable display and form behavior belongs in components.
- Maintain responsive, keyboard-accessible interfaces with visible focus states and semantic HTML.
- Read `.agents/design.md` before changing user-interface behavior or styling.
- Do not add a library when the existing stack can solve the task cleanly.
- Store runtime secrets in Netlify with Functions scope, never in `netlify.toml`.
- Never deploy, generate credentials, or change Netlify resources unless the user explicitly asks.

## Verification

Before handing off a code change, run the smallest relevant checks and always
run `npm run build` for changes to application code or configuration. Report
checks that could not be run and why.

See [`.agents/commands.md`](.agents/commands.md) for the canonical commands and
their side effects, and [`.agents/design.md`](.agents/design.md) for the
required design workflow.
