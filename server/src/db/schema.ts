/**
 * Database schema as TypeScript (TASK2 §1.2).
 *
 * This file is the source of truth: `drizzle-kit generate` compares it with the
 * previous snapshot and writes the SQL migration itself. Queries elsewhere
 * import these table objects, so a renamed column becomes a type error rather
 * than a runtime surprise.
 */

import { boolean, check, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/** One contact pair as stored inside the jsonb column. */
export interface ContactRow {
  id: string;
  label: string;
  value: string;
}

/**
 * The profile is a single row: one user, one CV, one set of contacts.
 *
 * Enforced by a CHECK on a fixed id rather than by convention, so a second row
 * is rejected by the database itself. Without it, a bug could insert a second
 * profile and the app would silently read whichever came back first.
 *
 * Contacts live in jsonb rather than their own table on purpose: they are read
 * and written as one list, never queried or joined individually, so a table
 * would buy nothing and cost a join.
 */
export const profile = pgTable(
  'profile',
  {
    id: integer('id').primaryKey().default(1),
    cvText: text('cv_text').notNull().default(''),
    contacts: jsonb('contacts').$type<ContactRow[]>().notNull().default([]),
    signatureEnabled: boolean('signature_enabled').notNull().default(false),
    signatureRu: text('signature_ru').notNull().default(''),
    signatureEn: text('signature_en').notNull().default(''),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check('profile_single_row', sql`${table.id} = 1`)],
);

export type ProfileRow = typeof profile.$inferSelect;
export type ProfileInsert = typeof profile.$inferInsert;
