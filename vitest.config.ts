import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { alias: { '#imports': fileURLToPath(new URL('./tests/support/nitro-imports.ts', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['tests/server/**/*.test.ts'],
    clearMocks: true,
    deps: {
      // Bundle the sanitizer's CommonJS-to-ESM boundary just as Nitro does.
      optimizer: { ssr: { enabled: true, include: ['sanitize-html', 'htmlparser2'] } }
    }
  }
})
