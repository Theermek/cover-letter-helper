/**
 * The API client is the only place that touches the network, so this is where
 * failure handling is pinned down (TASK2 §1.5): every fault leaves here as an
 * AppError with a message a user can act on, and the token is attached to
 * everything except the health check.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { installChromeStub } from '../ui/testing/chromeStub';
import { installFetchStub } from './testing/fetchStub';
import { isAppErrorShape } from '../lib/errors';

const configured = {
  server: { url: 'http://localhost:3000', token: 'test-token' },
  provider: 'openai',
  apiKeys: { openai: 'sk-test' },
  models: {},
  fetchedModels: {},
  defaults: { language: 'ru', length: 'medium' },
};

/** Returns the AppError a call rejected with, failing the test if it resolved. */
const rejection = async (run: () => Promise<unknown>) => {
  try {
    await run();
  } catch (error) {
    if (isAppErrorShape(error)) return error;
    throw error;
  }
  throw new Error('ожидалась ошибка, но вызов завершился успешно');
};

beforeEach(() => {
  installChromeStub({ settings: configured });
  installFetchStub();
});

describe('apiRequest', () => {
  it('sends the token and the base url from settings', async () => {
    const stub = installFetchStub({ cvText: 'CV' });
    const { fetchProfile } = await import('./profile');

    await fetchProfile();

    expect(stub.calls[0]?.url).toBe('http://localhost:3000/profile');
    expect(stub.calls[0]?.token).toBe('test-token');
  });

  it('joins the url without doubling the slash', async () => {
    installChromeStub({
      settings: { ...configured, server: { url: 'http://localhost:3000/', token: 't' } },
    });
    const stub = installFetchStub();
    const { fetchProfile } = await import('./profile');

    await fetchProfile();

    expect(stub.calls[0]?.url).toBe('http://localhost:3000/profile');
  });

  it('explains that the address is missing instead of calling fetch', async () => {
    installChromeStub({ settings: { ...configured, server: { url: '', token: 't' } } });
    const stub = installFetchStub();
    const { fetchProfile } = await import('./profile');

    const error = await rejection(fetchProfile);

    expect(error.message).toContain('адрес сервера');
    expect(stub.calls).toHaveLength(0);
  });

  it('explains that the token is missing instead of calling fetch', async () => {
    installChromeStub({ settings: { ...configured, server: { url: 'http://x', token: '  ' } } });
    const stub = installFetchStub();
    const { fetchProfile } = await import('./profile');

    const error = await rejection(fetchProfile);

    expect(error.kind).toBe('invalid_key');
    expect(stub.calls).toHaveLength(0);
  });

  it('turns an unreachable server into a readable network error', async () => {
    const stub = installFetchStub();
    stub.offline = true;
    const { fetchProfile } = await import('./profile');

    const error = await rejection(fetchProfile);

    expect(error.kind).toBe('network');
    expect(error.message).toContain('localhost:3000');
    expect(error.message).toContain('запущен');
  });

  it('turns a rejected token into an actionable message', async () => {
    const stub = installFetchStub();
    stub.unauthorized = true;
    const { fetchProfile } = await import('./profile');

    const error = await rejection(fetchProfile);

    expect(error.kind).toBe('invalid_key');
    expect(error.message).toContain('токен');
  });

  it('checks health without a token, so a missing token is distinguishable', async () => {
    installChromeStub({ settings: { ...configured, server: { url: 'http://localhost:3000', token: '' } } });
    const stub = installFetchStub();
    const { checkHealth } = await import('./client');

    await checkHealth();

    expect(stub.calls[0]?.url).toBe('http://localhost:3000/health');
    expect(stub.calls[0]?.token).toBeNull();
  });
});

describe('profile api', () => {
  it('rejects a response that does not match the shared schema', async () => {
    installChromeStub({ settings: configured });
    const stub = installFetchStub();
    // A server that answers with the wrong shape must fail here, not inside a
    // component as "undefined is not iterable".
    stub.profile = { cvText: 'CV' } as never;
    const { fetchProfile } = await import('./profile');

    const error = await rejection(fetchProfile);

    expect(error.kind).toBe('bad_response');
  });

  it('sends only the fields being changed', async () => {
    const stub = installFetchStub({ cvText: 'старое' });
    const { saveProfile } = await import('./profile');

    await saveProfile({ cvText: 'новое' });

    expect(stub.calls[0]?.method).toBe('PUT');
    expect(stub.calls[0]?.body).toEqual({ cvText: 'новое' });
  });

  it('bumps the revision so other open pages reload', async () => {
    const chrome = installChromeStub({ settings: configured });
    installFetchStub();
    const { saveProfile } = await import('./profile');

    await saveProfile({ cvText: 'новое' });

    expect(chrome.store.profileRevision).toBeTypeOf('number');
  });
});
