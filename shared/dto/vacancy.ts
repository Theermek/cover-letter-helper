/**
 * The vacancy contract, shared by the server and the extension (TASK2 §1.2).
 *
 * As with the profile: one zod schema, validated by the server on the way in
 * and by the extension on the way out. camelCase here is the API shape; the
 * database columns are snake_case and the repository maps between them.
 *
 * Timestamps are ISO-8601 strings rather than epoch milliseconds. JSON has no
 * date type, and an ISO string survives a round trip through the database, the
 * wire and a log file without anyone having to remember which unit it was in.
 */

import { z } from 'zod';
import { GRADES, SOFT_SKILL_CATEGORIES, WORK_FORMATS } from '../vocabulary.js';

export const HardSkillDtoSchema = z.object({
  name: z.string().min(1).max(120),
  /** The wording the vacancy actually used, for "in what form" reporting. */
  context: z.string().max(600),
  required: z.boolean(),
});

export const SoftSkillDtoSchema = z.object({
  name: z.enum(SOFT_SKILL_CATEGORIES),
  context: z.string().max(600),
  required: z.boolean(),
});

/**
 * Everything about a vacancy that a client may set. Split out from the full DTO
 * so that create and patch can be derived from it instead of being described
 * twice: `id` and the timestamps belong to the server and never arrive as input.
 */
const VacancyFieldsSchema = z.object({
  sourceText: z.string().min(1).max(200_000),
  /** SHA-256 of the normalised source text -- the deduplication key. */
  textHash: z.string().min(16).max(128),
  url: z.string().max(2000).nullable(),
  company: z.string().max(200).nullable(),
  title: z.string().max(200).nullable(),
  grade: z.enum(GRADES).nullable(),
  workFormat: z.enum(WORK_FORMATS).nullable(),
  /** The pay line exactly as the vacancy worded it, kept for honesty. */
  salaryRaw: z.string().max(200).nullable(),
  salaryMin: z.number().int().nonnegative().nullable(),
  salaryMax: z.number().int().nonnegative().nullable(),
  salaryCurrency: z.string().max(8).nullable(),
  hardSkills: z.array(HardSkillDtoSchema).max(100),
  softSkills: z.array(SoftSkillDtoSchema).max(50),
  letter: z.string().max(40_000),
});

export const VacancyDtoSchema = VacancyFieldsSchema.extend({
  id: z.string().min(1),
  /** ISO-8601, both set by the server. */
  createdAt: z.string(),
  updatedAt: z.string(),
});

/**
 * Creating a vacancy requires only the text and its hash; everything the
 * analysis did not find is simply absent and the service stores a null. That is
 * deliberate: a missing salary must read as "not stated", never as a guess.
 */
export const VacancyCreateSchema = VacancyFieldsSchema.partial().extend({
  sourceText: VacancyFieldsSchema.shape.sourceText,
  textHash: VacancyFieldsSchema.shape.textHash,
});

/** A PATCH carries only the fields the user actually edited. */
export const VacancyPatchSchema = VacancyFieldsSchema.omit({ textHash: true }).partial();

export const VacancyListSchema = z.object({
  items: z.array(VacancyDtoSchema),
  /** Total rows in the table, not in this page -- the UI shows "N saved". */
  total: z.number().int().nonnegative(),
});

export type HardSkillDto = z.infer<typeof HardSkillDtoSchema>;
export type SoftSkillDto = z.infer<typeof SoftSkillDtoSchema>;
export type VacancyDto = z.infer<typeof VacancyDtoSchema>;
export type VacancyCreate = z.infer<typeof VacancyCreateSchema>;
export type VacancyPatch = z.infer<typeof VacancyPatchSchema>;
export type VacancyList = z.infer<typeof VacancyListSchema>;
