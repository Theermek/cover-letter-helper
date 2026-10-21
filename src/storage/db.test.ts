/**
 * Deduplication is an explicit acceptance criterion (TASK §10, stage 4):
 * regenerating the same vacancy must refresh the record, not add a second one,
 * because duplicates would silently distort the market statistics.
 */

import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { vacancyTextHash } from '../lib/hash';
import { computeMarketStats } from '../lib/statistics';
import type { NewVacancy } from './db';

// Imported lazily so `fake-indexeddb/auto` is installed first.
const db = async () => import('./db');

const vacancy = async (text: string, over: Partial<NewVacancy> = {}): Promise<NewVacancy> => ({
  sourceText: text,
  textHash: await vacancyTextHash(text),
  company: 'Acme',
  title: 'Frontend',
  grade: 'middle',
  workFormat: 'remote',
  hardSkills: [{ name: 'React', context: 'React + Next.js', required: true }],
  softSkills: [{ name: 'Communication', context: 'общение', required: false }],
  letter: 'письмо',
  ...over,
});

beforeEach(async () => {
  const { clearVacancies } = await db();
  await clearVacancies();
});

describe('upsertVacancy', () => {
  it('stores a new vacancy', async () => {
    const { upsertVacancy, countVacancies } = await db();

    const { created, record } = await upsertVacancy(await vacancy('Ищем React-разработчика'));

    expect(created).toBe(true);
    expect(record.id).toBeTruthy();
    expect(await countVacancies()).toBe(1);
  });

  it('refreshes instead of duplicating when the same vacancy is generated again', async () => {
    const { upsertVacancy, countVacancies } = await db();
    const text = 'Ищем React-разработчика';

    const first = await upsertVacancy(await vacancy(text));
    const second = await upsertVacancy(await vacancy(text, { letter: 'новое письмо' }));

    expect(second.created).toBe(false);
    expect(await countVacancies()).toBe(1);
    // Identity and creation time survive; content is refreshed.
    expect(second.record.id).toBe(first.record.id);
    expect(second.record.createdAt).toBe(first.record.createdAt);
    expect(second.record.letter).toBe('новое письмо');
  });

  it('treats differently formatted copies of one vacancy as the same record', async () => {
    const { upsertVacancy, countVacancies } = await db();

    await upsertVacancy(await vacancy('Ищем Frontend-разработчика.\nReact, TypeScript.'));
    await upsertVacancy(await vacancy('  ищем   frontend разработчика!!  react;  typescript  '));

    expect(await countVacancies()).toBe(1);
  });

  it('keeps genuinely different vacancies apart', async () => {
    const { upsertVacancy, countVacancies } = await db();

    await upsertVacancy(await vacancy('Ищем React-разработчика'));
    await upsertVacancy(await vacancy('Ищем Go-разработчика'));

    expect(await countVacancies()).toBe(2);
  });

  it('canonicalises skill names on write', async () => {
    const { upsertVacancy } = await db();

    const { record } = await upsertVacancy(
      await vacancy('вакансия', {
        hardSkills: [{ name: 'ReactJS', context: 'ReactJS', required: true }],
      }),
    );

    expect(record.hardSkills[0]?.name).toBe('React');
  });

  it('does not let a repeat generation inflate the statistics', async () => {
    const { upsertVacancy, listVacancies } = await db();
    const text = 'Ищем React-разработчика';

    await upsertVacancy(await vacancy(text));
    await upsertVacancy(await vacancy(text));
    await upsertVacancy(await vacancy(text));

    const stats = computeMarketStats(await listVacancies());
    expect(stats.totalVacancies).toBe(1);
    expect(stats.hard[0]?.vacancyCount).toBe(1);
    expect(stats.hard[0]?.percent).toBe(100);
  });
});

describe('listVacancies and deleteVacancy', () => {
  it('returns the newest vacancy first', async () => {
    const { upsertVacancy, listVacancies } = await db();

    const older = await upsertVacancy(await vacancy('первая'));
    // createdAt comes from Date.now(); force a distinct, later timestamp.
    await new Promise((resolve) => setTimeout(resolve, 2));
    const newer = await upsertVacancy(await vacancy('вторая'));

    const list = await listVacancies();
    expect(list.map((v) => v.id)).toEqual([newer.record.id, older.record.id]);
  });

  it('removes a single record', async () => {
    const { upsertVacancy, deleteVacancy, countVacancies } = await db();

    const { record } = await upsertVacancy(await vacancy('одна'));
    await upsertVacancy(await vacancy('две'));
    await deleteVacancy(record.id);

    expect(await countVacancies()).toBe(1);
  });
});

describe('importVacancies', () => {
  it('adds new records and skips ones already present', async () => {
    const { upsertVacancy, importVacancies, listVacancies, countVacancies } = await db();

    await upsertVacancy(await vacancy('уже есть'));
    const existing = (await listVacancies())[0]!;
    const incoming = { ...existing, id: 'foreign-id' };
    const fresh = {
      ...existing,
      id: 'another-id',
      sourceText: 'новая',
      textHash: await vacancyTextHash('новая'),
    };

    const result = await importVacancies([incoming, fresh]);

    expect(result).toEqual({ added: 1, skipped: 1 });
    expect(await countVacancies()).toBe(2);
  });

  it('re-keys imported records so a foreign id cannot collide', async () => {
    const { importVacancies, listVacancies } = await db();
    const imported = { ...(await vacancy('извне')), id: 'foreign-id', createdAt: 1, updatedAt: 1 };

    await importVacancies([imported]);

    expect((await listVacancies())[0]?.id).not.toBe('foreign-id');
  });

  it('skips entries that carry no text hash', async () => {
    const { importVacancies, countVacancies } = await db();
    const broken = { ...(await vacancy('битая')), id: 'x', createdAt: 1, updatedAt: 1, textHash: '' };

    expect(await importVacancies([broken])).toEqual({ added: 0, skipped: 1 });
    expect(await countVacancies()).toBe(0);
  });
});
