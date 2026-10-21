/**
 * Vacancy storage in IndexedDB (TASK §7).
 *
 * Deduplication is enforced by a unique index on `textHash`: generating a letter
 * for the same vacancy twice refreshes the existing record instead of adding a
 * second one, so repeat generations cannot skew the statistics.
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { normalizeHardSkills, normalizeSoftSkills } from '../lib/skillNormalize';
import type { VacancyRecord } from './types';

const DB_NAME = 'cover-letter-helper';
const DB_VERSION = 1;
const STORE = 'vacancies';

interface VacancyDB extends DBSchema {
  vacancies: {
    key: string;
    value: VacancyRecord;
    indexes: { textHash: string; createdAt: number };
  };
}

let dbPromise: Promise<IDBPDatabase<VacancyDB>> | null = null;

const db = (): Promise<IDBPDatabase<VacancyDB>> => {
  dbPromise ??= openDB<VacancyDB>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      const store = database.createObjectStore(STORE, { keyPath: 'id' });
      store.createIndex('textHash', 'textHash', { unique: true });
      store.createIndex('createdAt', 'createdAt');
    },
  });
  return dbPromise;
};

export type NewVacancy = Omit<VacancyRecord, 'id' | 'createdAt' | 'updatedAt'>;

const withNormalisedSkills = <T extends { hardSkills: VacancyRecord['hardSkills']; softSkills: VacancyRecord['softSkills'] }>(
  record: T,
): T => ({
  ...record,
  hardSkills: normalizeHardSkills(record.hardSkills),
  softSkills: normalizeSoftSkills(record.softSkills),
});

/**
 * Inserts the vacancy, or refreshes the existing record with the same text hash.
 * Returns the stored record and whether it already existed.
 */
export const upsertVacancy = async (
  input: NewVacancy,
): Promise<{ record: VacancyRecord; created: boolean }> => {
  const database = await db();
  const tx = database.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  const existing = await store.index('textHash').get(input.textHash);
  const now = Date.now();

  const record: VacancyRecord = withNormalisedSkills(
    existing
      ? { ...existing, ...input, id: existing.id, createdAt: existing.createdAt, updatedAt: now }
      : { ...input, id: crypto.randomUUID(), createdAt: now, updatedAt: now },
  );

  await store.put(record);
  await tx.done;
  return { record, created: !existing };
};

/** Newest first. */
export const listVacancies = async (): Promise<VacancyRecord[]> => {
  const database = await db();
  const all = await database.getAllFromIndex(STORE, 'createdAt');
  return all.reverse();
};

export const countVacancies = async (): Promise<number> => (await db()).count(STORE);

export const getVacancy = async (id: string): Promise<VacancyRecord | undefined> =>
  (await db()).get(STORE, id);

export const deleteVacancy = async (id: string): Promise<void> => {
  await (await db()).delete(STORE, id);
};

export const clearVacancies = async (): Promise<void> => {
  await (await db()).clear(STORE);
};

/**
 * Merges imported records, skipping any whose text hash is already present
 * (TASK §9). Returns how many were added and how many were skipped as dupes.
 */
export const importVacancies = async (
  records: readonly VacancyRecord[],
): Promise<{ added: number; skipped: number }> => {
  const database = await db();
  const tx = database.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  const index = store.index('textHash');

  let added = 0;
  let skipped = 0;

  for (const record of records) {
    if (!record.textHash) {
      skipped += 1;
      continue;
    }
    if (await index.get(record.textHash)) {
      skipped += 1;
      continue;
    }

    // Re-key on import: an id from another profile may collide with a local one.
    await store.put(
      withNormalisedSkills({
        ...record,
        id: crypto.randomUUID(),
        createdAt: record.createdAt || Date.now(),
        updatedAt: Date.now(),
      }),
    );
    added += 1;
  }

  await tx.done;
  return { added, skipped };
};
