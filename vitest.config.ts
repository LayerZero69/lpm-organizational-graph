import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // No database, no service containers, no network. Every suite runs
    // against deterministic synthetic fixtures and the in-memory repository.
    environment: 'node',
    // Relative to the --dir root, so `test` and `test:acceptance` can each scope
    // to their own directory without a second config file.
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    root: '.',
    passWithNoTests: false,
  },
})
