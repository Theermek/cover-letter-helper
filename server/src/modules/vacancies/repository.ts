/**
 * Vacancy persistence: the only file in this module that knows SQL (TASK2 §1.2).
 */

import { count, desc, eq, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { vacancies, type VacancyInsert, type VacancyRow } from '../../db/schema.js';

export const listVacancyRows = async (
  limit: number,
  offset: number,
): Promise<VacancyRow[]> =>
  db.select().from(vacancies).orderBy(desc(vacancies.createdAt)).limit(limit).offset(offset);

export const countVacancyRows = async (): Promise<number> => {
  const rows = await db.select({ value: count() }).from(vacancies);
  return rows[0]?.value ?? 0;
};

export const findVacancyRow = async (id: string): Promise<VacancyRow | undefined> => {
  const rows = await db.select().from(vacancies).where(eq(vacancies.id, id)).limit(1);
  return rows[0];
};

/**
 * Only the two columns the statistics need, for every row.
 *
 * Selecting `*` here would pull every vacancy's full text and letter across the
 * wire to count skill names -- megabytes to produce two top-10 lists.
 */
export const listSkillColumns = async (): Promise<
  Pick<VacancyRow, 'hardSkills' | 'softSkills'>[]
> =>
  db
    .select({ hardSkills: vacancies.hardSkills, softSkills: vacancies.softSkills })
    .from(vacancies);

/**
 * Inserts the vacancy, or refreshes the row that already has this text hash.
 *
 * Wrapped in a transaction because the decision ("does this hash exist?") and
 * the action based on it must not be separated by another writer. Outside a
 * transaction, two simultaneous generations of the same vacancy could both see
 * "no row" and the second insert would then hit the unique index and fail.
 */
export const upsertVacancyRow = async (
  insertValues: Omit<VacancyInsert, 'id' | 'createdAt' | 'updatedAt'>,
  /**
   * What to write if the row already exists -- usually a subset of
   * `insertValues`. The two are passed separately because a new row needs an
   * explicit value for every column, while an existing one must keep the
   * columns the request said nothing about.
   */
  updateValues: Partial<Omit<VacancyRow, 'id' | 'createdAt' | 'updatedAt'>>,
): Promise<{ row: VacancyRow; created: boolean }> =>
  db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: vacancies.id })
      .from(vacancies)
      .where(eq(vacancies.textHash, insertValues.textHash))
      .limit(1);

    const current = existing[0];
    if (current) {
      const updated = await tx
        .update(vacancies)
        // createdAt is deliberately untouched: this is the same vacancy seen
        // again, and "when did I first apply" is the useful date.
        .set({ ...updateValues, updatedAt: new Date() })
        .where(eq(vacancies.id, current.id))
        .returning();
      return { row: updated[0]!, created: false };
    }

    const inserted = await tx.insert(vacancies).values(insertValues).returning();
    return { row: inserted[0]!, created: true };
  });

/** Applies only the given columns; absent ones keep their stored value. */
export const updateVacancyRow = async (
  id: string,
  patch: Partial<Omit<VacancyRow, 'id' | 'createdAt' | 'updatedAt'>>,
): Promise<VacancyRow | undefined> => {
  const updated = await db
    .update(vacancies)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(vacancies.id, id))
    .returning();
  return updated[0];
};

/** Returns false when there was nothing to delete, so the route can 404. */
export const deleteVacancyRow = async (id: string): Promise<boolean> => {
  const deleted = await db
    .delete(vacancies)
    .where(eq(vacancies.id, id))
    .returning({ id: vacancies.id });
  return deleted.length > 0;
};

/**
 * Bulk insert for the import, skipping rows whose hash is already stored.
 *
 * `onConflictDoNothing` makes the database do the deduplication in one
 * statement: `returning` then yields exactly the rows that were actually
 * inserted, so the count of skipped records needs no second query.
 */
export const insertNewVacancyRows = async (
  values: readonly Omit<VacancyInsert, 'id'>[],
): Promise<number> => {
  if (values.length === 0) return 0;

  const inserted = await db
    .insert(vacancies)
    .values(values as VacancyInsert[])
    .onConflictDoNothing({ target: vacancies.textHash })
    .returning({ id: vacancies.id });

  return inserted.length;
};

/** Used by the "wipe everything" button in the extension's settings. */
export const deleteAllVacancyRows = async (): Promise<void> => {
  await db.execute(sql`delete from ${vacancies}`);
};
