/**
 * In-memory stand-in for the server, for tests of the UI and the worker.
 *
 * Replaces globalThis.fetch and answers the profile endpoints from a plain
 * object. Tests stay fast and offline, and a request the extension should not
 * be making shows up as an explicit "unexpected request" failure.
 */

import { vi } from 'vitest';
import type { ProfileDto } from '../../../shared/dto/profile';

export const emptyProfile = (): ProfileDto => ({
  cvText: '',
  contacts: [],
  signature: { enabled: false, ru: '', en: '' },
  updatedAt: new Date('2026-11-14T10:00:00.000Z').toISOString(),
});

export interface FetchStub {
  profile: ProfileDto;
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

      return json(404, { error: `unexpected request: ${method} ${url}` });
    }),
  );

  return stub;
};
