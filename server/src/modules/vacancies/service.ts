/**
 * Vacancy logic: the layer between HTTP and SQL (TASK2 §1.2, §1.3).
 *
 * Two jobs live here. The first is translation, as in the profile module: rows
 * with Date objects in, camelCase JSON with ISO strings out. The second is the
 * rule that a stored vacancy is always canonical -- skill names are normalised
 * on the way in, so the table never fills up with "ReactJS" next to "React".
 */

import { normalizeHardSkills, normalizeSoftSkills } from '../stats/skillNormalize.js';
import { computeMarketStats } from '../stats/statistics.js';
import type { MarketStats } from '../../../../shared/dto/stats.js';
import type {
  VacancyCreate,
  VacancyDto,
  VacancyList,
  VacancyPatch,
} from '../../../../shared/dto/vacancy.js';
import type { VacancyInsert, VacancyRow } from '../../db/schema.js';
import { notFound } from '../../lib/httpError.js';
import {
  countVacancyRows,
  deleteVacancyRow,
  findVacancyRow,
  listSkillColumns,
  listVacancyRows,
  updateVacancyRow,
  upsertVacancyRow,
} from './repository.js';

export const DEFAULT_PAGE_SIZE = 50;

const toDto = (row: VacancyRow): VacancyDto => ({
  id: row.id,
  sourceText: row.sourceText,
  textHash: row.textHash,
  url: row.url,
  company: row.company,
  title: row.title,
  grade: row.grade ?? null,
  workFormat: row.workFormat ?? null,
  salaryRaw: row.salaryRaw,
  salaryMin: row.salaryMin,
  salaryMax: row.salaryMax,
  salaryCurrency: row.salaryCurrency,
  hardSkills: row.hardSkills,
  softSkills: row.softSkills,
  letter: row.letter,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

/**
 * Columns for a brand-new row.
 *
 * Every analysed field that was not sent becomes an explicit null rather than
 * being left out: "the vacancy does not say" is information, and storing it as
 * null keeps it distinguishable from a zero or an empty string.
 */
export const toInsertColumns = (
  input: VacancyCreate,
): Omit<VacancyInsert, 'id' | 'createdAt' | 'updatedAt'> => ({
  sourceText: input.sourceText,
  textHash: input.textHash,
  url: input.url ?? null,
  company: input.company ?? null,
  title: input.title ?? null,
  grade: input.grade ?? null,
  workFormat: input.workFormat ?? null,
  salaryRaw: input.salaryRaw ?? null,
  salaryMin: input.salaryMin ?? null,
  salaryMax: input.salaryMax ?? null,
  salaryCurrency: input.salaryCurrency ?? null,
  hardSkills: normalizeHardSkills(input.hardSkills ?? []),
  softSkills: normalizeSoftSkills(input.softSkills ?? []),
  letter: input.letter ?? '',
});

/**
 * Columns for a row that already exists: only what the request actually sent.
 *
 * The difference from the insert path matters. Padding the absent fields with
 * nulls here would mean a POST that omits the skills erases the skills already
 * stored for that vacancy -- silently emptying the statistics.
 */
const toUpdateColumns = (
  input: VacancyCreate,
): Partial<Omit<VacancyRow, 'id' | 'createdAt' | 'updatedAt'>> => {
  const columns: Partial<Omit<VacancyRow, 'id' | 'createdAt' | 'updatedAt'>> = {
    sourceText: input.sourceText,
  };

  if (input.url !== undefined) columns.url = input.url;
  if (input.company !== undefined) columns.company = input.company;
  if (input.title !== undefined) columns.title = input.title;
  if (input.grade !== undefined) columns.grade = input.grade;
  if (input.workFormat !== undefined) columns.workFormat = input.workFormat;
  if (input.salaryRaw !== undefined) columns.salaryRaw = input.salaryRaw;
  if (input.salaryMin !== undefined) columns.salaryMin = input.salaryMin;
  if (input.salaryMax !== undefined) columns.salaryMax = input.salaryMax;
  if (input.salaryCurrency !== undefined) columns.salaryCurrency = input.salaryCurrency;
  if (input.hardSkills !== undefined) columns.hardSkills = normalizeHardSkills(input.hardSkills);
  if (input.softSkills !== undefined) columns.softSkills = normalizeSoftSkills(input.softSkills);
  if (input.letter !== undefined) columns.letter = input.letter;

  return columns;
};

/**
 * Saving the same vacancy twice is not an error: it refreshes the stored row.
 * The caller learns which happened so the route can answer 201 or 200 and the
 * popup can say "saved" or "updated".
 */
export const createVacancy = async (
  input: VacancyCreate,
): Promise<{ vacancy: VacancyDto; created: boolean }> => {
  const { row, created } = await upsertVacancyRow(
    toInsertColumns(input),
    toUpdateColumns(input),
  );
  return { vacancy: toDto(row), created };
};

export const listVacancies = async (limit: number, offset: number): Promise<VacancyList> => {
  const [rows, total] = await Promise.all([listVacancyRows(limit, offset), countVacancyRows()]);
  return { items: rows.map(toDto), total };
};

export const getVacancy = async (id: string): Promise<VacancyDto> => {
  const row = await findVacancyRow(id);
  if (!row) throw notFound('Вакансия не найдена');
  return toDto(row);
};

export const patchVacancy = async (id: string, patch: VacancyPatch): Promise<VacancyDto> => {
  const columns: Partial<Omit<VacancyRow, 'id' | 'createdAt' | 'updatedAt'>> = {};

  if (patch.sourceText !== undefined) columns.sourceText = patch.sourceText;
  if (patch.url !== undefined) columns.url = patch.url;
  if (patch.company !== undefined) columns.company = patch.company;
  if (patch.title !== undefined) columns.title = patch.title;
  if (patch.grade !== undefined) columns.grade = patch.grade;
  if (patch.workFormat !== undefined) columns.workFormat = patch.workFormat;
  if (patch.salaryRaw !== undefined) columns.salaryRaw = patch.salaryRaw;
  if (patch.salaryMin !== undefined) columns.salaryMin = patch.salaryMin;
  if (patch.salaryMax !== undefined) columns.salaryMax = patch.salaryMax;
  if (patch.salaryCurrency !== undefined) columns.salaryCurrency = patch.salaryCurrency;
  if (patch.hardSkills !== undefined) columns.hardSkills = normalizeHardSkills(patch.hardSkills);
  if (patch.softSkills !== undefined) columns.softSkills = normalizeSoftSkills(patch.softSkills);
  if (patch.letter !== undefined) columns.letter = patch.letter;

  // Nothing to write: answer with the current state rather than bumping
  // updatedAt for a request that changed nothing.
  if (Object.keys(columns).length === 0) return getVacancy(id);

  const row = await updateVacancyRow(id, columns);
  if (!row) throw notFound('Вакансия не найдена');
  return toDto(row);
};

export const removeVacancy = async (id: string): Promise<void> => {
  const deleted = await deleteVacancyRow(id);
  if (!deleted) throw notFound('Вакансия не найдена');
};

/**
 * Statistics are recomputed on every request, not cached.
 *
 * That is what makes an extended alias dictionary improve the numbers over
 * vacancies saved long ago: normalisation runs again on read, inside
 * `computeMarketStats`. A cached table of counts would freeze yesterday's
 * spelling mistakes.
 */
export const getStats = async (): Promise<MarketStats> =>
  computeMarketStats(await listSkillColumns());
