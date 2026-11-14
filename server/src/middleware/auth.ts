/**
 * Bearer token check (TASK2 §1.1).
 *
 * One static token for one user. Compared with a constant-time function so the
 * comparison cannot be used to guess the token byte by byte, and the token is
 * never written to a log or returned in a response.
 */

import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { unauthorized } from '../lib/httpError.js';

const equals = (a: string, b: string): boolean => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  // timingSafeEqual throws on different lengths, so compare those first.
  return left.length === right.length && timingSafeEqual(left, right);
};

export const requireToken: RequestHandler = (req, _res, next) => {
  const header = req.get('authorization') ?? '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token || !equals(token, env.API_TOKEN)) {
    next(unauthorized());
    return;
  }

  next();
};
