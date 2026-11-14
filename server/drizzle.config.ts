import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

/**
 * drizzle-kit reads this to know what to diff and where to put the result.
 * `migrations` are plain SQL files kept in git -- see server/README.md.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
  // Printed statements are reviewed before being applied, never auto-pushed.
  strict: true,
  verbose: true,
});
