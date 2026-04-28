import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './server/db/schema.ts',
  out: './server/db/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgres://finanzas:finanzas_c0a15d197bbf6728e29fcc26@187.124.116.185:5433/finanzas',
  },
})
