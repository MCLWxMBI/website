# Project commands

Use npm for this repository. Run commands from the repository root.

| Command | Purpose |
| --- | --- |
| `npm install` | Install dependencies and update `package-lock.json` when needed. |
| `npm run dev` | Start the Nuxt development server. |
| `npm run build` | Create the production Cloudflare-compatible Nitro build. |
| `npm run generate` | Generate a pre-rendered build when static output is required. |
| `npm run preview` | Build and serve the Worker locally with Wrangler. |
| `npm run cf-typegen` | Regenerate TypeScript definitions for configured Cloudflare bindings. |
| `npm run deploy` | Build and deploy with Wrangler. Run only with explicit user approval. |

Generated `.nuxt`, `.output`, and `.wrangler` files are build artifacts and
must not be committed. `cf-typegen` can change tracked type-definition files,
so run it only when Cloudflare bindings change.
