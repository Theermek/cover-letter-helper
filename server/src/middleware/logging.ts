/**
 * Request logging (TASK2 §1.1): method, path, status, duration.
 *
 * Deliberately no request or response bodies and no headers: bodies carry the
 * CV and vacancy texts, headers carry the token. A log is the easiest place to
 * leak a secret into, so it only ever sees metadata.
 */

import type { RequestHandler } from 'express';

export const requestLogger: RequestHandler = (req, res, next) => {
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${ms.toFixed(1)}ms`);
  });

  next();
};
