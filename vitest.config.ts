import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { alias: { '#imports': fileURLToPath(new URL('./tests/support/nitro-imports.ts', import.meta.url)) } },
  test: { server: { deps: { inline: ['nuxt-auth-utils', 'nuxt-csurf'] } }, environment: 'node', include: ['tests/server/**/*.test.ts'], clearMocks: true }
})
