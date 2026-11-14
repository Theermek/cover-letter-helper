/**
 * /vacancies and /stats (TASK2 §1.2, §1.3).
 *
 * Validate, call the service, answer. The only HTTP-specific decision made
 * here is the status code: 201 when a vacancy was created, 200 when an existing
 * one was refreshed, so the client can tell the two apart without guessing.
 */

import { Router } from 'express';
import { z } from 'zod';
import {
  VacancyCreateSchema,
  VacancyPatchSchema,
} from '../../../../shared/dto/vacancy.js';
import {
  DEFAULT_PAGE_SIZE,
  createVacancy,
  getStats,
  getVacancy,
  listVacancies,
  patchVacancy,
  removeVacancy,
} from './service.js';

/**
 * Query parameters arrive as strings, so they are coerced here. The cap on
 * `limit` is deliberate: without it a client could ask for every row at once
 * and make the server build a response big enough to run it out of memory.
 */
const ListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(DEFAULT_PAGE_SIZE),
  offset: z.coerce.number().int().min(0).default(0),
});

/** A path parameter is user input too: a malformed id must be 400, not a 500. */
const IdParamSchema = z.object({ id: z.uuid('Некорректный id вакансии') });

export const vacancyRouter = Router();

vacancyRouter.get('/vacancies', async (req, res) => {
  const { limit, offset } = ListQuerySchema.parse(req.query);
  res.json(await listVacancies(limit, offset));
});

vacancyRouter.post('/vacancies', async (req, res) => {
  const { vacancy, created } = await createVacancy(VacancyCreateSchema.parse(req.body));
  res.status(created ? 201 : 200).json(vacancy);
});

vacancyRouter.get('/vacancies/:id', async (req, res) => {
  const { id } = IdParamSchema.parse(req.params);
  res.json(await getVacancy(id));
});

vacancyRouter.patch('/vacancies/:id', async (req, res) => {
  const { id } = IdParamSchema.parse(req.params);
  res.json(await patchVacancy(id, VacancyPatchSchema.parse(req.body)));
});

vacancyRouter.delete('/vacancies/:id', async (req, res) => {
  const { id } = IdParamSchema.parse(req.params);
  await removeVacancy(id);
  // Nothing useful to return, and the client already knows the id it deleted.
  res.status(204).end();
});

vacancyRouter.get('/stats', async (_req, res) => {
  res.json(await getStats());
});
