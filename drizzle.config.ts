import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';

// Migrations must use the DIRECT (unpooled) Neon connection string.
// Schema changes do not work correctly through the connection pooler.
const url = process.env.DATABASE_URL_UNPOOLED;
if (!url) throw new Error('DATABASE_URL_UNPOOLED is not set (use the direct, non-pooler Neon string)');

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
