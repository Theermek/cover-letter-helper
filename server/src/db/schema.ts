/**
 * Database schema as TypeScript (TASK2 §1.2).
 *
 * This file is the source of truth: `drizzle-kit generate` compares it with the
 * previous snapshot and writes the SQL migration itself. Queries elsewhere
 * import these table objects, so a renamed column becomes a type error rather
 * than a runtime surprise.
 */

import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { HardSkillDto, SoftSkillDto } from '../../../shared/dto/vacancy.js';
import type { Grade, WorkFormat } from '../../../shared/vocabulary.js';

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

/**
 * One saved vacancy (TASK2 §1.2), the table the statistics are computed over.
 *
 * `text_hash` carries a UNIQUE index, which is what makes deduplication a
 * property of the database rather than of the code that happens to run before
 * the insert: generating a letter for the same vacancy twice refreshes the row
 * instead of adding a second one, so repeat generations cannot skew statistics.
 *
 * The skills stay in jsonb for the same reason contacts do: they are always
 * read as a whole list belonging to one vacancy. Statistics aggregate them in
 * memory, over at most a few thousand rows -- a join would cost more than it
 * saves, and the shape is already pinned by the DTO.
 *
 * Every analysed field is nullable on purpose. A vacancy that states no salary
 * must store null, not a zero and not a guess.
 */
export const vacancies = pgTable(
  'vacancies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceText: text('source_text').notNull(),
    textHash: text('text_hash').notNull(),
    url: text('url'),
    company: text('company'),
    title: text('title'),
    grade: text('grade').$type<Grade>(),
    workFormat: text('work_format').$type<WorkFormat>(),
    /** The pay line exactly as worded, kept alongside the parsed numbers. */
    salaryRaw: text('salary_raw'),
    salaryMin: integer('salary_min'),
    salaryMax: integer('salary_max'),
    salaryCurrency: text('salary_currency'),
    hardSkills: jsonb('hard_skills').$type<HardSkillDto[]>().notNull().default([]),
    softSkills: jsonb('soft_skills').$type<SoftSkillDto[]>().notNull().default([]),
    letter: text('letter').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('vacancies_text_hash_key').on(table.textHash),
    // The list is always "newest first"; without this index that is a full
    // table scan plus a sort on every page load.
    index('vacancies_created_at_idx').on(table.createdAt.desc()),
  ],
);

export type VacancyRow = typeof vacancies.$inferSelect;
export type VacancyInsert = typeof vacancies.$inferInsert;
