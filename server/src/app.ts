/**
 * Express application assembly.
 *
 * Built separately from `index.ts`, which starts it. That split is what lets
 * tests drive the real app with supertest without occupying a port.
 *
 * Middleware order matters and is top to bottom: log every request, allow the
 * extension's origin, parse JSON, answer /health, then require a token for
 * everything else.
 */

import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { requestLogger } from './middleware/logging.js';
import { requireToken } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import { healthRouter } from './routes/health.js';
import { profileRouter } from './modules/profile/routes.js';

/**
 * A browser refuses a cross-origin response unless the server names the origin
 * explicitly. An unpacked extension's id changes whenever its folder moves, so
 * with EXTENSION_ID unset any chrome-extension:// origin is accepted (dev
 * convenience); with it set, only that one is.
 */
const corsOrigin = (
  origin: string | undefined,
  callback: (error: Error | null, allow?: boolean) => void,
): void => {
  // No Origin header at all: curl, server-to-server, same-origin. Not a browser
  // cross-origin request, so there is nothing to protect against here.
  if (!origin) {
    callback(null, true);
    return;
  }

  const allowed = env.EXTENSION_ID
    ? `chrome-extension://${env.EXTENSION_ID}`
    : null;

  if (allowed ? origin === allowed : origin.startsWith('chrome-extension://')) {
    callback(null, true);
    return;
  }

  callback(null, false);
};

export const createApp = (): express.Express => {
  const app = express();

  app.disable('x-powered-by');
  app.use(requestLogger);
  app.use(cors({ origin: corsOrigin, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] }));
  // The CV and a vacancy text are long; the default 100kb limit is too tight.
  app.use(express.json({ limit: '2mb' }));

  app.use(healthRouter);

  // Everything registered after this line needs the token.
  app.use(requireToken);

  app.use(profileRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
