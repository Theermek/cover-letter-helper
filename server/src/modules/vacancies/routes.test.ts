/**
 * Vacancy and statistics endpoints (TASK2 §1.2, §1.3).
 *
 * The repository is mocked, so these describe the HTTP contract: codes, shapes,
 * validation, and the two rules worth pinning down -- a repeat save is an
 * update rather than a duplicate, and skill names are canonicalised before they
 * reach the database.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { VacancyRow } from '../../db/schema.js';

vi.mock('../../db/client.js', () => ({
  pingDatabase: vi.fn(async () => undefined),
  closeDatabase: vi.fn(async () => undefined),
  db: {},
  pool: {},
}));

const listVacancyRows = vi.fn();
const countVacancyRows = vi.fn();
const findVacancyRow = vi.fn();
const listSkillColumns = vi.fn();
const upsertVacancyRow = vi.fn();
const updateVacancyRow = vi.fn();
const deleteVacancyRow = vi.fn();

vi.mock('./repository.js', () => ({
  listVacancyRows: (limit: number, offset: number) => listVacancyRows(limit, offset),
  countVacancyRows: () => countVacancyRows(),
  findVacancyRow: (id: string) => findVacancyRow(id),
  listSkillColumns: () => listSkillColumns(),
  upsertVacancyRow: (insertValues: unknown, updateValues: unknown) =>
    upsertVacancyRow(insertValues, updateValues),
  updateVacancyRow: (id: string, patch: unknown) => updateVacancyRow(id, patch),
  deleteVacancyRow: (id: string) => deleteVacancyRow(id),
  insertNewVacancyRows: vi.fn(),
  deleteAllVacancyRows: vi.fn(),
}));

const { createApp } = await import('../../app.js');
const { env } = await import('../../config/env.js');

const app = createApp();
const auth = { Authorization: `Bearer ${env.API_TOKEN}` };
const ID = '11111111-1111-4111-8111-111111111111';

const row = (over: Partial<VacancyRow> = {}): VacancyRow => ({
  id: ID,
  sourceText: 'Ищем React-разработчика',
  textHash: 'a'.repeat(64),
  url: null,
  company: 'Acme',
  title: 'Frontend',
  grade: 'middle',
  workFormat: 'remote',
  salaryRaw: null,
  salaryMin: null,
  salaryMax: null,
  salaryCurrency: null,
  hardSkills: [{ name: 'React', context: 'React + Next.js', required: true }],
  softSkills: [{ name: 'Communication', context: 'общение', required: false }],
  letter: 'Здравствуйте!',
  createdAt: new Date('2026-11-01T10:00:00.000Z'),
  updatedAt: new Date('2026-11-02T10:00:00.000Z'),
  ...over,
});

const body = {
  sourceText: 'Ищем React-разработчика',
  textHash: 'a'.repeat(64),
};

beforeEach(() => {
  vi.clearAllMocks();
  listVacancyRows.mockResolvedValue([row()]);
  countVacancyRows.mockResolvedValue(1);
  findVacancyRow.mockResolvedValue(row());
  listSkillColumns.mockResolvedValue([]);
  upsertVacancyRow.mockResolvedValue({ row: row(), created: true });
  updateVacancyRow.mockImplementation(async (_id: string, patch: Partial<VacancyRow>) =>
    row(patch),
  );
  deleteVacancyRow.mockResolvedValue(true);
});

describe('GET /vacancies', () => {
  it('requires a token', async () => {
    expect((await request(app).get('/vacancies')).status).toBe(401);
  });

  it('returns API shape with a total that counts the whole table', async () => {
    const response = await request(app).get('/vacancies').set(auth);

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
    expect(response.body.items[0]).toMatchObject({
      id: ID,
      company: 'Acme',
      // Dates leave as ISO strings, never as Date objects or epoch numbers.
      createdAt: '2026-11-01T10:00:00.000Z',
      updatedAt: '2026-11-02T10:00:00.000Z',
    });
  });

  it('applies the default page size and accepts an explicit one', async () => {
    await request(app).get('/vacancies').set(auth);
    expect(listVacancyRows).toHaveBeenCalledWith(50, 0);

    await request(app).get('/vacancies?limit=5&offset=10').set(auth);
    expect(listVacancyRows).toHaveBeenLastCalledWith(5, 10);
  });

  it('refuses a page size big enough to be a problem', async () => {
    const response = await request(app).get('/vacancies?limit=100000').set(auth);

    expect(response.status).toBe(400);
    expect(listVacancyRows).not.toHaveBeenCalled();
  });
});

describe('POST /vacancies', () => {
  it('answers 201 when the vacancy is new', async () => {
    const response = await request(app).post('/vacancies').set(auth).send(body);

    expect(response.status).toBe(201);
    expect(response.body.id).toBe(ID);
  });

  it('answers 200 when the same text was already saved', async () => {
    upsertVacancyRow.mockResolvedValue({ row: row(), created: false });

    const response = await request(app).post('/vacancies').set(auth).send(body);

    // A repeat generation is not an error and must not create a second row --
    // otherwise the statistics would count the same vacancy twice.
    expect(response.status).toBe(200);
  });

  it('stores an explicit null for everything the analysis did not find', async () => {
    await request(app).post('/vacancies').set(auth).send(body);

    expect(upsertVacancyRow.mock.calls[0]?.[0]).toMatchObject({
      company: null,
      salaryRaw: null,
      salaryMin: null,
      hardSkills: [],
      letter: '',
    });
  });

  it('does not erase stored fields that a repeat save left out', async () => {
    upsertVacancyRow.mockResolvedValue({ row: row(), created: false });

    await request(app).post('/vacancies').set(auth).send({ ...body, company: 'Acme Inc' });

    // The update path carries only what was sent. Padding it with nulls would
    // silently empty the skills of a vacancy that was saved in full earlier.
    const updateValues = upsertVacancyRow.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(updateValues).toEqual({ sourceText: body.sourceText, company: 'Acme Inc' });
  });

  it('canonicalises skill names before they reach the database', async () => {
    await request(app)
      .post('/vacancies')
      .set(auth)
      .send({
        ...body,
        hardSkills: [
          { name: 'ReactJS', context: 'React', required: true },
          { name: 'react.js', context: 'React и Next', required: false },
        ],
      });

    const values = upsertVacancyRow.mock.calls[0]?.[0] as { hardSkills: unknown[] };
    // Both spellings are one skill, required because one mention said so.
    expect(values.hardSkills).toEqual([
      { name: 'React', context: 'React и Next', required: true },
    ]);
  });

  it('rejects a body without the deduplication key', async () => {
    const response = await request(app)
      .post('/vacancies')
      .set(auth)
      .send({ sourceText: 'текст' });

    expect(response.status).toBe(400);
    expect(JSON.stringify(response.body.details)).toContain('textHash');
    expect(upsertVacancyRow).not.toHaveBeenCalled();
  });
});

describe('PATCH and DELETE /vacancies/:id', () => {
  it('writes only the fields that were sent', async () => {
    const response = await request(app)
      .patch(`/vacancies/${ID}`)
      .set(auth)
      .send({ letter: 'правленое письмо' });

    expect(response.status).toBe(200);
    expect(updateVacancyRow).toHaveBeenCalledWith(ID, { letter: 'правленое письмо' });
  });

  it('turns a malformed id into 400 rather than letting SQL fail', async () => {
    const response = await request(app).patch('/vacancies/not-a-uuid').set(auth).send({});

    expect(response.status).toBe(400);
    expect(findVacancyRow).not.toHaveBeenCalled();
  });

  it('answers 404 for a vacancy that is not there', async () => {
    deleteVacancyRow.mockResolvedValue(false);

    const response = await request(app).delete(`/vacancies/${ID}`).set(auth);

    expect(response.status).toBe(404);
  });

  it('answers 204 with no body on a successful delete', async () => {
    const response = await request(app).delete(`/vacancies/${ID}`).set(auth);

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});
  });
});

describe('GET /stats', () => {
  it('counts a skill once per vacancy and reports percentages', async () => {
    listSkillColumns.mockResolvedValue([
      {
        hardSkills: [
          { name: 'React', context: 'React', required: true },
          { name: 'ReactJS', context: 'React', required: false },
        ],
        softSkills: [],
      },
      {
        hardSkills: [{ name: 'Vue', context: 'Vue 3', required: false }],
        softSkills: [],
      },
    ]);

    const response = await request(app).get('/stats').set(auth);

    expect(response.status).toBe(200);
    expect(response.body.totalVacancies).toBe(2);
    expect(response.body.lowSample).toBe(true);
    expect(response.body.hard[0]).toMatchObject({
      name: 'React',
      vacancyCount: 1,
      percent: 50,
      requiredPercent: 100,
    });
  });

  it('asks the database only for the two columns it needs', async () => {
    await request(app).get('/stats').set(auth);

    // Statistics must not drag every vacancy's full text across the wire.
    expect(listSkillColumns).toHaveBeenCalledTimes(1);
    expect(listVacancyRows).not.toHaveBeenCalled();
  });
});
