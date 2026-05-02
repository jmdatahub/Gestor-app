import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['server/**/*.{test,spec}.ts'],
    exclude: ['node_modules', 'dist', 'client'],
    coverage: {
      provider: 'v8',
      include: ['server/**/*.ts'],
      exclude: ['server/**/*.test.ts', 'server/**/*.spec.ts', 'node_modules'],
    },
  },
})
