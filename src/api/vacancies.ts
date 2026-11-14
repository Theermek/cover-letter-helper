/**
 * Vacancies over HTTP (TASK2 §1.5).
 *
 * Same contract as the profile module: every response is validated with the
 * schema the server validated the request with, so a shape we did not expect
 * fails here with a readable message rather than deep inside a component.
 */

import {
  VacancyDtoSchema,
  VacancyListSchema,
  type VacancyCreate,
  type VacancyDto,
  type VacancyList,
  type VacancyPatch,
} from '../../shared/dto/vacancy';
import { ImportResultSchema, type ImportResult } from '../../shared/dto/importFile';
import { appError } from '../lib/errors';
import { apiRequest, apiRequestWithStatus } from './client';
import type { z } from 'zod';

const parse = <T extends z.ZodType>(schema: T, payload: unknown): z.infer<T> => {
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw appError('bad_response', result.error.issues.map((i) => i.path.join('.')).join(', '));
  }
  return result.data;
};

export const fetchVacancies = async (limit = 50, offset = 0): Promise<VacancyList> =>
  parse(VacancyListSchema, await apiRequest(`/vacancies?limit=${limit}&offset=${offset}`));

/**
 * Saves a vacancy, or refreshes the one already stored under the same text
 * hash. `created` comes from the status code, not from a field in the body.
 */
export const saveVacancy = async (
  input: VacancyCreate,
): Promise<{ vacancy: VacancyDto; created: boolean }> => {
  const { data, status } = await apiRequestWithStatus('/vacancies', {
    method: 'POST',
    body: input,
  });
  return { vacancy: parse(VacancyDtoSchema, data), created: status === 201 };
};

export const patchVacancy = async (id: string, patch: VacancyPatch): Promise<VacancyDto> =>
  parse(VacancyDtoSchema, await apiRequest(`/vacancies/${id}`, { method: 'PATCH', body: patch }));

export const deleteVacancy = async (id: string): Promise<void> => {
  await apiRequest(`/vacancies/${id}`, { method: 'DELETE' });
};

/**
 * Sends a whole export file. The server deduplicates and answers with what it
 * actually did, which is the only honest thing to show the user afterwards.
 */
export const importData = async (payload: unknown): Promise<ImportResult> =>
  parse(ImportResultSchema, await apiRequest('/import', { method: 'POST', body: payload }));
