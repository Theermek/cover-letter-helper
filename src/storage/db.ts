/**
 * The legacy local vacancy store (TASK §7, superseded by TASK2 §1.3).
 *
 * Vacancies live on the server now. Nothing writes here any more: this file is
 * read-only history, kept so the data a user accumulated before the server
 * existed can be handed to `POST /import` once, and cleared afterwards.
 *
 * It goes away entirely in the next slice, once the transfer is confirmed.
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
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

/** Newest first. */
export const listVacancies = async (): Promise<VacancyRecord[]> => {
  const database = await db();
  const all = await database.getAllFromIndex(STORE, 'createdAt');
  return all.reverse();
};

export const countVacancies = async (): Promise<number> => (await db()).count(STORE);

export const clearVacancies = async (): Promise<void> => {
  await (await db()).clear(STORE);
};
