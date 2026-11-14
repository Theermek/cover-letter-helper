/**
 * The vacancy, stats and import calls (TASK2 §1.5).
 *
 * These pin down the three things the UI depends on and cannot see for itself:
 * "created" comes from the status code, paging walks the whole archive, and a
 * response of the wrong shape is refused here rather than rendered.
 */

// buildLocalSnapshot reads the legacy IndexedDB store, so it needs to exist.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { installChromeStub } from '../ui/testing/chromeStub';
import { installFetchStub, type FetchStub } from './testing/fetchStub';
import { isAppErrorShape } from '../lib/errors';
import type { VacancyDto } from '../../shared/dto/vacancy';

const configured = {
  server: { url: 'http://localhost:3000', token: 'test-token' },
  provider: 'openai',
  apiKeys: { openai: 'sk-test' },
  models: {},
  fetchedModels: {},
  defaults: { language: 'ru', length: 'medium' },
};

const vacancy = { sourceText: 'Ищем React-разработчика', textHash: 'a'.repeat(64) };

const rejection = async (run: () => Promise<unknown>) => {
  try {
    await run();
  } catch (error) {
    if (isAppErrorShape(error)) return error;
    throw error;
  }
  throw new Error('ожидалась ошибка, но вызов завершился успешно');
};

let server: FetchStub;

beforeEach(() => {
  installChromeStub({ settings: configured });
  server = installFetchStub();
});

describe('saveVacancy', () => {
  it('reports a new vacancy as created and a repeat as an update', async () => {
    const { saveVacancy } = await import('./vacancies');

    const first = await saveVacancy(vacancy);
    const second = await saveVacancy(vacancy);

    expect(first.created).toBe(true);
    // 200 instead of 201: the same text hash, so the server refreshed the row.
    expect(second.created).toBe(false);
    expect(second.vacancy.id).toBe(first.vacancy.id);
  });
});

describe('fetchVacancies', () => {
  it('asks for the page it was told to', async () => {
    const { fetchVacancies } = await import('./vacancies');

    await fetchVacancies(10, 20);

    expect(server.calls[0]?.url).toBe('http://localhost:3000/vacancies?limit=10&offset=20');
  });
});

describe('fetchStats', () => {
  it('returns the ranking the server computed', async () => {
    server.stats = {
      totalVacancies: 3,
      lowSample: true,
      hard: [
        {
          name: 'React',
          label: 'React',
          vacancyCount: 2,
          percent: 67,
          requiredCount: 1,
          requiredPercent: 50,
          topContexts: [{ text: 'React + Next.js', count: 2 }],
        },
      ],
      soft: [],
    };
    const { fetchStats } = await import('./stats');

    const stats = await fetchStats();

    expect(server.calls[0]?.url).toBe('http://localhost:3000/stats');
    expect(stats.hard[0]?.percent).toBe(67);
  });

  it('refuses a malformed ranking instead of rendering undefined', async () => {
    server.stats = { totalVacancies: 1 } as never;

    const error = await rejection(async () => {
      const { fetchStats } = await import('./stats');
      return fetchStats();
    });

    expect(error.kind).toBe('bad_response');
  });
});

describe('buildExport', () => {
  it('pages through the whole archive rather than asking for everything at once', async () => {
    // 250 stored vacancies against a 200-row page limit: two requests.
    for (let i = 0; i < 250; i += 1) {
      // The dash before the padding keeps hash-1 and hash-10 distinct.
      const hash = `hash-${i}-`.padEnd(64, '0');
      server.vacancies.set(hash, {
        id: `v${i}`,
        sourceText: `вакансия ${i}`,
        textHash: hash,
        url: null,
        company: 'Acme',
        title: null,
        grade: null,
        workFormat: null,
        salaryRaw: null,
        salaryMin: null,
        salaryMax: null,
        salaryCurrency: null,
        hardSkills: [],
        softSkills: [],
        letter: '',
        createdAt: '2026-11-01T10:00:00.000Z',
        updatedAt: '2026-11-01T10:00:00.000Z',
      } satisfies VacancyDto);
    }
    const { buildExport } = await import('../lib/exportImport');

    const file = await buildExport();

    const listCalls = server.calls.filter((c) => c.url.includes('/vacancies?'));
    expect(listCalls.length).toBeGreaterThan(1);
    expect(file.vacancies).toHaveLength(250);
    // The file format has always carried epoch milliseconds.
    expect(typeof file.vacancies[0]?.createdAt).toBe('number');
  });

  it('takes the CV and the signature from the server, not from stale local settings', async () => {
    installChromeStub({ settings: { ...configured, cvText: 'старое локальное CV' } });
    server = installFetchStub({ cvText: 'CV с сервера' });
    const { buildExport } = await import('../lib/exportImport');

    const file = await buildExport();

    expect(file.settings?.cvText).toBe('CV с сервера');
  });

  it('never puts an API key in the file', async () => {
    const { buildExport } = await import('../lib/exportImport');

    const file = await buildExport();

    expect(JSON.stringify(file)).not.toContain('sk-test');
  });
});

describe('migrateLocalDataToServer', () => {
  it('sends the local snapshot to /import and returns what the server did', async () => {
    server.importResult = { imported: 7, skipped: 2, seededProfileFields: ['cvText'] };
    const { migrateLocalDataToServer } = await import('../lib/exportImport');

    const result = await migrateLocalDataToServer();

    const call = server.calls.find((c) => c.url.endsWith('/import'));
    expect(call?.method).toBe('POST');
    expect(call?.body).toHaveProperty('vacancies');
    expect(result).toEqual({ imported: 7, skipped: 2, seededProfileFields: ['cvText'] });
  });
});
