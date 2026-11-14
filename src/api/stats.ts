/**
 * Market statistics over HTTP (TASK2 §1.5).
 *
 * The counting moved to the server with the code that does it, so this page no
 * longer loads every vacancy to add up skills -- it asks for the result. The
 * schema is shared with the server, so the shape cannot drift.
 */

import { MarketStatsSchema, type MarketStats } from '../../shared/dto/stats';
import { appError } from '../lib/errors';
import { apiRequest } from './client';

export const fetchStats = async (): Promise<MarketStats> => {
  const result = MarketStatsSchema.safeParse(await apiRequest('/stats'));
  if (!result.success) {
    throw appError('bad_response', result.error.issues.map((i) => i.path.join('.')).join(', '));
  }
  return result.data;
};
