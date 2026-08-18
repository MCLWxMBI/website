# Project commands

Use npm for this repository. Run commands from the repository root.

| Command | Purpose |
| --- | --- |
| `npm install` | Install dependencies and update `package-lock.json` when needed. |
| `npm run dev` | Start Nuxt with local Netlify platform emulation provided by `@netlify/nuxt`. |
| `npm run build` | Create the production Netlify Functions build and the `dist` publish directory. |
| `npm run generate` | Generate a pre-rendered build when static output is required. |

Generated `.nuxt`, `.output`, `dist`, and `.netlify` files are build
artifacts and must not be committed. Production and deploy-preview releases are
created by Netlify from the connected Git repository; there is no local deploy
command. Runtime secrets belong in Netlify with Functions scope and must not be
written to `netlify.toml`.
