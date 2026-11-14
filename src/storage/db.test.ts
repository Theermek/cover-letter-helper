/**
 * The legacy local store (TASK2 §1.3).
 *
 * Deduplication and import now live on the server and are tested there. What
 * still matters here is the migration path: data an earlier version wrote into
 * IndexedDB must be readable, in the order the transfer expects, and clearable
 * afterwards. If this broke, a user's archive would quietly fail to move.
 */

import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { openDB } from 'idb';
import type { VacancyRecord } from './types';

// Imported lazily so `fake-indexeddb/auto` is installed first.
const db = async () => import('./db');

const record = (id: string, createdAt: number): VacancyRecord => ({
  id,
  createdAt,
  updatedAt: createdAt,
  sourceText: `вакансия ${id}`,
  textHash: `hash-${id}`,
  company: 'Acme',
  title: 'Frontend',
  grade: 'middle',
  workFormat: 'remote',
  hardSkills: [{ name: 'React', context: 'React + Next.js', required: true }],
  softSkills: [{ name: 'Communication', context: 'общение', required: false }],
  letter: 'письмо',
});

/** Writes straight into the object store, the way the old version did. */
const seed = async (records: VacancyRecord[]): Promise<void> => {
  const database = await openDB('cover-letter-helper', 1, {
    upgrade(instance) {
      const store = instance.createObjectStore('vacancies', { keyPath: 'id' });
      store.createIndex('textHash', 'textHash', { unique: true });
      store.createIndex('createdAt', 'createdAt');
    },
  });
  const tx = database.transaction('vacancies', 'readwrite');
  for (const item of records) await tx.store.put(item);
  await tx.done;
  database.close();
};

beforeEach(async () => {
  const { clearVacancies } = await db();
  await clearVacancies();
});

describe('legacy vacancy store', () => {
  it('reads nothing from an empty browser without failing', async () => {
    const { listVacancies, countVacancies } = await db();

    expect(await listVacancies()).toEqual([]);
    expect(await countVacancies()).toBe(0);
  });

  it('reads records written by an earlier version, newest first', async () => {
    await seed([record('a', 1000), record('b', 3000), record('c', 2000)]);
    const { listVacancies, countVacancies } = await db();

    expect((await listVacancies()).map((v) => v.id)).toEqual(['b', 'c', 'a']);
    expect(await countVacancies()).toBe(3);
  });

  it('keeps the fields the import needs', async () => {
    await seed([record('a', 1000)]);
    const { listVacancies } = await db();

    const [first] = await listVacancies();
    expect(first).toMatchObject({
      sourceText: 'вакансия a',
      textHash: 'hash-a',
      createdAt: 1000,
      hardSkills: [{ name: 'React', context: 'React + Next.js', required: true }],
    });
  });

  it('clears the store, which is what happens after a successful transfer', async () => {
    await seed([record('a', 1000), record('b', 2000)]);
    const { clearVacancies, countVacancies } = await db();

    await clearVacancies();

    expect(await countVacancies()).toBe(0);
  });
});
