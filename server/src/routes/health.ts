/**
 * GET /health -- the one endpoint without authorisation (TASK2 §1.1).
 *
 * No token on purpose: the extension's "check connection" button must be able
 * to tell "server unreachable" from "token wrong", and that is impossible if
 * both answer 401. It reports nothing but liveness, so it leaks nothing.
 */

import { Router } from 'express';
import { pingDatabase } from '../db/client.js';

export const healthRouter = Router();

healthRouter.get('/health', async (_req, res) => {
  try {
    await pingDatabase();
    res.json({ status: 'ok', db: 'ok' });
  } catch (error) {
    // 503, not 500: the server is fine, its dependency is not.
    console.error('[health] база недоступна:', error instanceof Error ? error.message : error);
    res.status(503).json({ status: 'degraded', db: 'unavailable' });
  }
});
