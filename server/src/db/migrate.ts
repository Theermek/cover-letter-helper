/**
 * Applies pending migrations and exits (TASK2 §1.6: migrations run as their own
 * command, never blindly on every server start).
 *
 * Drizzle keeps a record of applied migrations in its own table, so running
 * this repeatedly is safe: only files it has not seen are executed.
 */

import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, closeDatabase } from './client.js';

const run = async (): Promise<void> => {
  console.log('[migrate] применяю миграции из ./drizzle');
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('[migrate] готово');
};

run()
  .catch((error: unknown) => {
    console.error('[migrate] не удалось:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => closeDatabase());
