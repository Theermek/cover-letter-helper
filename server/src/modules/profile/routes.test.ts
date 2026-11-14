/**
 * Profile endpoints (TASK2 §1.3).
 *
 * The repository is mocked, so these tests describe the HTTP contract -- codes,
 * shapes, validation, authorisation -- without needing a running database.
 * The mapping between row and DTO is exercised through the real service.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { ProfileRow } from '../../db/schema.js';

vi.mock('../../db/client.js', () => ({
  pingDatabase: vi.fn(async () => undefined),
  closeDatabase: vi.fn(async () => undefined),
  db: {},
  pool: {},
}));

const ensureProfile = vi.fn();
const updateProfile = vi.fn();

vi.mock('./repository.js', () => ({
  findProfile: vi.fn(),
  ensureProfile: () => ensureProfile(),
  updateProfile: (patch: unknown) => updateProfile(patch),
}));

const { createApp } = await import('../../app.js');
const { env } = await import('../../config/env.js');

const app = createApp();
const auth = { Authorization: `Bearer ${env.API_TOKEN}` };

const row = (over: Partial<ProfileRow> = {}): ProfileRow => ({
  id: 1,
  cvText: 'React, TypeScript, три года.',
  contacts: [{ id: 'c1', label: 'Telegram', value: '@theermek' }],
  signatureEnabled: true,
  signatureRu: 'С уважением, Эрмек',
  signatureEn: 'Best regards, Ermek',
  updatedAt: new Date('2026-11-14T10:00:00.000Z'),
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  ensureProfile.mockResolvedValue(row());
  updateProfile.mockImplementation(async (patch: Partial<ProfileRow>) => row(patch));
});

describe('GET /profile', () => {
  it('requires a token', async () => {
    expect((await request(app).get('/profile')).status).toBe(401);
  });

  it('returns the profile in API shape, not in database shape', async () => {
    const response = await request(app).get('/profile').set(auth);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      cvText: 'React, TypeScript, три года.',
      contacts: [{ id: 'c1', label: 'Telegram', value: '@theermek' }],
      signature: { enabled: true, ru: 'С уважением, Эрмек', en: 'Best regards, Ermek' },
      updatedAt: '2026-11-14T10:00:00.000Z',
    });
    // Database naming must not leak into the API.
    expect(response.body).not.toHaveProperty('signature_ru');
    expect(response.body).not.toHaveProperty('id');
  });
});

describe('PUT /profile', () => {
  it('writes only the fields that were sent', async () => {
    const response = await request(app).put('/profile').set(auth).send({ cvText: 'новое CV' });

    expect(response.status).toBe(200);
    // Contacts and signature were not in the request, so they are not written.
    expect(updateProfile).toHaveBeenCalledWith({ cvText: 'новое CV' });
    expect(response.body.cvText).toBe('новое CV');
  });

  it('spreads the signature object across its three columns', async () => {
    await request(app)
      .put('/profile')
      .set(auth)
      .send({ signature: { enabled: false, ru: 'ру', en: 'en' } });

    expect(updateProfile).toHaveBeenCalledWith({
      signatureEnabled: false,
      signatureRu: 'ру',
      signatureEn: 'en',
    });
  });

  it('rejects a malformed body with 400 and names the field', async () => {
    const response = await request(app)
      .put('/profile')
      .set(auth)
      .send({ contacts: [{ label: 'Telegram' }] });

    expect(response.status).toBe(400);
    expect(updateProfile).not.toHaveBeenCalled();
    expect(JSON.stringify(response.body.details)).toContain('contacts.0');
  });

  it('refuses a client-supplied updatedAt', async () => {
    const response = await request(app)
      .put('/profile')
      .set(auth)
      .send({ cvText: 'CV', updatedAt: '2000-01-01T00:00:00.000Z' });

    // The timestamp belongs to the server; the extra key is simply dropped.
    expect(response.status).toBe(200);
    expect(updateProfile).toHaveBeenCalledWith({ cvText: 'CV' });
  });

  it('is a no-op for an empty patch', async () => {
    const response = await request(app).put('/profile').set(auth).send({});

    expect(response.status).toBe(200);
    expect(updateProfile).not.toHaveBeenCalled();
  });
});
