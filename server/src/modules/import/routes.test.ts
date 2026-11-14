/**
 * POST /import (TASK2 §1.3).
 *
 * What matters here is non-destructiveness, so that is what the tests state:
 * duplicates are skipped rather than doubled, a damaged record does not take
 * the rest of the file down with it, original dates survive, and a profile
 * field that already has a value is never overwritten.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { ProfileRow, VacancyInsert } from '../../db/schema.js';

vi.mock('../../db/client.js', () => ({
  pingDatabase: vi.fn(async () => undefined),
  closeDatabase: vi.fn(async () => undefined),
  db: {},
  pool: {},
}));

const insertNewVacancyRows = vi.fn();
const ensureProfile = vi.fn();
const updateProfile = vi.fn();

vi.mock('../vacancies/repository.js', () => ({
  insertNewVacancyRows: (rows: unknown) => insertNewVacancyRows(rows),
  listVacancyRows: vi.fn(),
  countVacancyRows: vi.fn(),
  findVacancyRow: vi.fn(),
  listSkillColumns: vi.fn(async () => []),
  upsertVacancyRow: vi.fn(),
  updateVacancyRow: vi.fn(),
  deleteVacancyRow: vi.fn(),
  deleteAllVacancyRows: vi.fn(),
}));

vi.mock('../profile/repository.js', () => ({
  findProfile: vi.fn(),
  ensureProfile: () => ensureProfile(),
  updateProfile: (patch: unknown) => updateProfile(patch),
}));

const { createApp } = await import('../../app.js');
const { env } = await import('../../config/env.js');

const app = createApp();
const auth = { Authorization: `Bearer ${env.API_TOKEN}` };

const blankProfile = (over: Partial<ProfileRow> = {}): ProfileRow => ({
  id: 1,
  cvText: '',
  contacts: [],
  signatureEnabled: false,
  signatureRu: '',
  signatureEn: '',
  updatedAt: new Date('2026-11-14T10:00:00.000Z'),
  ...over,
});

const vacancy = (hash: string, over: Record<string, unknown> = {}) => ({
  id: `local-${hash}`,
  sourceText: `вакансия ${hash}`,
  textHash: hash,
  company: 'Acme',
  title: 'Frontend',
  grade: 'middle',
  workFormat: 'remote',
  hardSkills: [{ name: 'ReactJS', context: 'React', required: true }],
  softSkills: [{ name: 'Communication', context: 'общение', required: false }],
  letter: 'Здравствуйте!',
  createdAt: Date.parse('2026-03-05T09:00:00.000Z'),
  updatedAt: Date.parse('2026-03-05T09:00:00.000Z'),
  ...over,
});

/** The rows handed to the database by the last import. */
const insertedRows = (): Omit<VacancyInsert, 'id'>[] =>
  (insertNewVacancyRows.mock.calls[0]?.[0] ?? []) as Omit<VacancyInsert, 'id'>[];

beforeEach(() => {
  vi.clearAllMocks();
  ensureProfile.mockResolvedValue(blankProfile());
  updateProfile.mockResolvedValue(blankProfile());
  // By default the database accepts everything it is given.
  insertNewVacancyRows.mockImplementation(async (rows: unknown[]) => rows.length);
});

describe('POST /import', () => {
  it('requires a token', async () => {
    expect((await request(app).post('/import').send({})).status).toBe(401);
  });

  it('imports a v2 file and reports the counts', async () => {
    const response = await request(app)
      .post('/import')
      .set(auth)
      .send({
        schemaVersion: 2,
        exportedAt: Date.now(),
        vacancies: [vacancy('h1'), vacancy('h2')],
        contacts: [{ id: 'c1', label: 'Telegram', value: '@theermek' }],
        settings: { cvText: 'Три года React.', signature: { enabled: true, ru: 'ру', en: 'en' } },
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      imported: 2,
      skipped: 0,
      seededProfileFields: ['cvText', 'contacts', 'signature'],
    });
  });

  it('imports a v1 file that has no contacts at all', async () => {
    const response = await request(app)
      .post('/import')
      .set(auth)
      .send({ schemaVersion: 1, vacancies: [vacancy('h1')], settings: null });

    expect(response.status).toBe(200);
    expect(response.body.imported).toBe(1);
    expect(response.body.seededProfileFields).toEqual([]);
  });

  it('counts rows the database already had as skipped', async () => {
    // Two sent, one accepted: the other hash was already stored.
    insertNewVacancyRows.mockResolvedValue(1);

    const response = await request(app)
      .post('/import')
      .set(auth)
      .send({ vacancies: [vacancy('h1'), vacancy('h2')] });

    expect(response.body).toMatchObject({ imported: 1, skipped: 1 });
  });

  it('deduplicates inside the file before touching the database', async () => {
    const response = await request(app)
      .post('/import')
      .set(auth)
      .send({ vacancies: [vacancy('h1'), vacancy('h1'), vacancy('h2')] });

    expect(insertedRows()).toHaveLength(2);
    expect(response.body).toMatchObject({ imported: 2, skipped: 1 });
  });

  it('skips an unreadable record and imports the rest', async () => {
    const response = await request(app)
      .post('/import')
      .set(auth)
      .send({
        vacancies: [vacancy('h1'), { company: 'Acme' }, null, vacancy('h2')],
      });

    expect(response.body).toMatchObject({ imported: 2, skipped: 2 });
  });

  it('keeps the original date and canonicalises the skills', async () => {
    await request(app).post('/import').set(auth).send({ vacancies: [vacancy('h1')] });

    const row = insertedRows()[0]!;
    expect(row.createdAt).toEqual(new Date('2026-03-05T09:00:00.000Z'));
    expect(row.hardSkills).toEqual([{ name: 'React', context: 'React', required: true }]);
  });

  it('substitutes the import date when a record has none', async () => {
    await request(app)
      .post('/import')
      .set(auth)
      .send({ vacancies: [vacancy('h1', { createdAt: undefined })] });

    expect(insertedRows()[0]!.createdAt).toBeInstanceOf(Date);
  });

  it('never overwrites a profile field that already has a value', async () => {
    ensureProfile.mockResolvedValue(
      blankProfile({ cvText: 'моё текущее CV', contacts: [{ id: 'c9', label: 'GitHub', value: 'x' }] }),
    );

    const response = await request(app)
      .post('/import')
      .set(auth)
      .send({
        vacancies: [],
        contacts: [{ id: 'c1', label: 'Telegram', value: '@theermek' }],
        settings: { cvText: 'старое CV из файла', signature: { enabled: true, ru: 'ру', en: 'en' } },
      });

    // Only the signature was empty here, so only the signature is seeded.
    expect(response.body.seededProfileFields).toEqual(['signature']);
    expect(updateProfile).toHaveBeenCalledWith({
      signatureEnabled: true,
      signatureRu: 'ру',
      signatureEn: 'en',
    });
  });

  it('does not touch the profile when the file carries nothing for it', async () => {
    await request(app).post('/import').set(auth).send({ vacancies: [vacancy('h1')] });

    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('rejects a body that is not an object at all', async () => {
    const response = await request(app).post('/import').set(auth).send('[1,2,3]');

    expect(response.status).toBe(400);
    expect(insertNewVacancyRows).not.toHaveBeenCalled();
  });
});
