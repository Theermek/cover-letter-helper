/**
 * Database connection (TASK2 §1.1).
 *
 * A pool rather than a single connection: every HTTP request may need the
 * database at the same moment, and opening a TCP connection per request would
 * cost more than the query itself. The pool keeps a few open and lends them out.
 *
 * `pg` talks plain Postgres over TCP, so the same driver works against the
 * local Docker container now and against Neon later -- only DATABASE_URL moves.
 */

import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { env } from '../config/env.js';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  // Fail fast instead of hanging a request for half a minute when the database
  // is not running -- the most common situation in development.
  connectionTimeoutMillis: 5000,
});

pool.on('error', (error) => {
  // An idle client died (database restarted, laptop slept). The pool replaces
  // it on its own; without this listener Node would kill the process.
  console.error('[db] ошибка простаивающего соединения:', error.message);
});

export const db = drizzle(pool);

/** Used by /health: proves the connection works, not just that the pool exists. */
export const pingDatabase = async (): Promise<void> => {
  await db.execute(sql`select 1`);
};

export const closeDatabase = async (): Promise<void> => {
  await pool.end();
};
