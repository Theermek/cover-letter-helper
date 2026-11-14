/**
 * Contract of the skeleton (TASK2 §1.1): /health answers without a token,
 * everything else does not, and an unknown path is a clean 404 rather than a
 * stack trace.
 */

import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';

// The database is not part of this test: /health must report "degraded" when it
// is unreachable, and the auth checks must not need a database at all.
vi.mock('./db/client.js', () => ({
  pingDatabase: vi.fn(async () => undefined),
  closeDatabase: vi.fn(async () => undefined),
  db: {},
  pool: {},
}));

const { createApp } = await import('./app.js');
const { env } = await import('./config/env.js');

const app = createApp();

describe('GET /health', () => {
  it('answers without any token', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', db: 'ok' });
  });

  it('reports a degraded state when the database is unreachable', async () => {
    const { pingDatabase } = await import('./db/client.js');
    vi.mocked(pingDatabase).mockRejectedValueOnce(new Error('connection refused'));

    const response = await request(app).get('/health');

    // 503, not 500: the server works, its dependency does not.
    expect(response.status).toBe(503);
    expect(response.body.db).toBe('unavailable');
  });
});

describe('authorisation', () => {
  it('rejects a protected request without a token', async () => {
    const response = await request(app).get('/anything');

    expect(response.status).toBe(401);
    expect(response.body.error).toContain('токен');
  });

  it('rejects a wrong token', async () => {
    const response = await request(app)
      .get('/anything')
      .set('Authorization', 'Bearer not-the-real-token');

    expect(response.status).toBe(401);
  });

  it('rejects a token sent without the Bearer scheme', async () => {
    const response = await request(app).get('/anything').set('Authorization', env.API_TOKEN);

    expect(response.status).toBe(401);
  });

  it('lets a correct token through to the 404 handler', async () => {
    const response = await request(app)
      .get('/nothing-here')
      .set('Authorization', `Bearer ${env.API_TOKEN}`);

    // Past the guard: the request reached routing and simply found no route.
    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Такого эндпоинта нет');
  });

  it('never echoes the token back', async () => {
    const response = await request(app)
      .get('/anything')
      .set('Authorization', `Bearer ${env.API_TOKEN}`);

    expect(JSON.stringify(response.body)).not.toContain(env.API_TOKEN);
  });
});
