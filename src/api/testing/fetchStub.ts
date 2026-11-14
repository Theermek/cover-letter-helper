/**
 * In-memory stand-in for the server, for tests of the UI and the worker.
 *
 * Replaces globalThis.fetch and answers the profile, vacancy, stats and import
 * endpoints from plain objects. Tests stay fast and offline, and a request the
 * extension should not be making shows up as an explicit "unexpected request"
 * failure rather than as a silent undefined.
 *
 * It mimics the two server behaviours the extension actually depends on: a
 * vacancy is keyed by its text hash, and saving a hash that is already stored
 * answers 200 instead of 201.
 */

import { vi } from 'vitest';
import type { ProfileDto } from '../../../shared/dto/profile';
import type { VacancyDto } from '../../../shared/dto/vacancy';
import type { MarketStats } from '../../../shared/dto/stats';

export const emptyProfile = (): ProfileDto => ({
  cvText: '',
  contacts: [],
  signature: { enabled: false, ru: '', en: '' },
  updatedAt: new Date('2026-11-14T10:00:00.000Z').toISOString(),
});

export const emptyStats = (): MarketStats => ({
  totalVacancies: 0,
  lowSample: true,
  hard: [],
  soft: [],
});

export interface FetchStub {
  profile: ProfileDto;
  /** Saved vacancies, keyed by text hash the way the server's index is. */
  vacancies: Map<string, VacancyDto>;
  stats: MarketStats;
  /** What POST /import answers. */
  importResult: { imported: number; skipped: number; seededProfileFields: string[] };
  /** Every request the extension made, in order. */
  calls: { url: string; method: string; body: unknown; token: string | null }[];
  /** Set to make requests fail the way an unreachable server does. */
  offline: boolean;
  /** Set to make the server reject the token. */
  unauthorized: boolean;
}

export const installFetchStub = (profile: Partial<ProfileDto> = {}): FetchStub => {
  const stub: FetchStub = {
    profile: { ...emptyProfile(), ...profile },
    vacancies: new Map(),
    stats: emptyStats(),
    importResult: { imported: 0, skipped: 0, seededProfileFields: [] },
    calls: [],
    offline: false,
    unauthorized: false,
  };

  const json = (status: number, payload: unknown): Response =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';
      const headers = new Headers(init?.headers);
      const body: unknown = init?.body ? JSON.parse(String(init.body)) : undefined;

      stub.calls.push({
        url,
        method,
        body,
        token: headers.get('Authorization')?.replace('Bearer ', '') ?? null,
      });

      // What fetch does when there is nothing listening on the other end.
      if (stub.offline) throw new TypeError('Failed to fetch');

      if (url.endsWith('/health')) return json(200, { status: 'ok', db: 'ok' });

      if (stub.unauthorized) return json(401, { error: 'Нужен действующий токен доступа' });

      if (url.endsWith('/profile')) {
        if (method === 'PUT') {
          const patch = (body ?? {}) as Partial<ProfileDto>;
          stub.profile = { ...stub.profile, ...patch, updatedAt: new Date().toISOString() };
        }
        return json(200, stub.profile);
      }

      if (url.endsWith('/stats')) return json(200, stub.stats);

      if (url.endsWith('/import')) return json(200, stub.importResult);

      const path = new URL(url, 'http://stub').pathname;

      if (path === '/vacancies' && method === 'POST') {
        const input = (body ?? {}) as Partial<VacancyDto>;
        const hash = input.textHash ?? '';
        const existing = stub.vacancies.get(hash);
        const now = new Date().toISOString();

        const blank: VacancyDto = {
          id: '',
          sourceText: '',
          textHash: hash,
          url: null,
          company: null,
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
          createdAt: now,
          updatedAt: now,
        };

        const vacancy: VacancyDto = {
          // Start from the stored row, apply what was sent, and let the server's
          // own fields win: an id and a creation date never come from a client.
          ...blank,
          ...(existing ?? {}),
          ...input,
          id: existing?.id ?? `vac-${stub.vacancies.size + 1}`,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        };

        stub.vacancies.set(hash, vacancy);
        return json(existing ? 200 : 201, vacancy);
      }

      if (path === '/vacancies' && method === 'GET') {
        const query = new URL(url, 'http://stub').searchParams;
        const limit = Number(query.get('limit') ?? 50);
        const offset = Number(query.get('offset') ?? 0);
        const all = [...stub.vacancies.values()];
        return json(200, { items: all.slice(offset, offset + limit), total: all.length });
      }

      const single = /^\/vacancies\/(.+)$/.exec(path);
      if (single) {
        const id = single[1]!;
        const entry = [...stub.vacancies.entries()].find(([, v]) => v.id === id);
        if (!entry) return json(404, { error: 'Вакансия не найдена' });

        if (method === 'DELETE') {
          stub.vacancies.delete(entry[0]);
          return new Response(null, { status: 204 });
        }
        if (method === 'PATCH') {
          const patched = { ...entry[1], ...((body ?? {}) as Partial<VacancyDto>) };
          stub.vacancies.set(entry[0], patched);
          return json(200, patched);
        }
        return json(200, entry[1]);
      }

      return json(404, { error: `unexpected request: ${method} ${url}` });
    }),
  );

  return stub;
};
