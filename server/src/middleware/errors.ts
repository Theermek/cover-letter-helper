/**
 * The single place that turns a thrown error into a response (TASK2 §1.1).
 *
 * Every route handler is async, so each one needs its errors funnelled here;
 * Express 5 forwards a rejected promise to this middleware automatically,
 * which is why handlers can simply throw.
 */

import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../lib/httpError.js';
import { isProduction } from '../config/env.js';

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'Такого эндпоинта нет' });
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.status).json(
      error.details === undefined
        ? { error: error.publicMessage }
        : { error: error.publicMessage, details: error.details },
    );
    return;
  }

  // A validation failure is the client's fault, so it earns a 400 and the field
  // list -- that is what makes a bad request debuggable from the extension.
  if (error instanceof ZodError) {
    res.status(400).json({
      error: 'Запрос не прошёл валидацию',
      details: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
    return;
  }

  // Anything else is a bug: log it in full, tell the client nothing specific.
  console.error('[unhandled]', error);
  res.status(500).json({
    error: 'Внутренняя ошибка сервера',
    ...(isProduction ? {} : { details: error instanceof Error ? error.message : String(error) }),
  });
};
