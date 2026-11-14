/**
 * GET and PUT /profile (TASK2 §1.3).
 *
 * The route layer does three things and nothing else: validate the input,
 * call the service, send the result. No SQL, no business rules -- that is what
 * keeps the endpoints readable and the logic testable without HTTP.
 */

import { Router } from 'express';
import { ProfileUpdateSchema } from '../../../../shared/dto/profile.js';
import { getProfile, saveProfile } from './service.js';

export const profileRouter = Router();

profileRouter.get('/profile', async (_req, res) => {
  res.json(await getProfile());
});

profileRouter.put('/profile', async (req, res) => {
  // Throwing on invalid input is enough: the error middleware turns a ZodError
  // into a 400 with the offending field list.
  const patch = ProfileUpdateSchema.parse(req.body);
  res.json(await saveProfile(patch));
});
