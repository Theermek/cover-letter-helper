/**
 * The import contract (TASK2 §1.3): the file the extension has always exported.
 *
 * This schema is deliberately the most forgiving one in the project. An import
 * file is old data -- written by an earlier version, possibly hand-edited --
 * and the useful behaviour is to take what is recognisable and skip the rest,
 * not to reject a 200-vacancy file over one malformed record.
 *
 * Hence `.catch()` on the soft spots: a field that cannot be read falls back to
 * a harmless value instead of failing the whole parse. The two fields that
 * genuinely cannot be guessed, `sourceText` and `textHash`, stay required, and
 * a record missing them is reported as skipped.
 *
 * Timestamps here are epoch milliseconds, because that is what the old
 * IndexedDB records hold. The server converts them; new data uses ISO strings.
 */

import { z } from 'zod';
import { GRADES, SOFT_SKILL_CATEGORIES, WORK_FORMATS } from '../vocabulary.js';

const nullableText = (max: number) => z.string().max(max).nullish().catch(null);

const ImportHardSkillSchema = z
  .object({
    name: z.string().min(1).max(120),
    context: z.string().max(600).catch(''),
    required: z.boolean().catch(false),
  })
  .catch({ name: '', context: '', required: false });

const ImportSoftSkillSchema = z
  .object({
    // An unknown category becomes "Other" rather than losing the whole record.
    name: z.enum(SOFT_SKILL_CATEGORIES).catch('Other'),
    context: z.string().max(600).catch(''),
    required: z.boolean().catch(false),
  })
  .catch({ name: 'Other', context: '', required: false });

export const ImportVacancySchema = z.object({
  sourceText: z.string().min(1).max(200_000),
  textHash: z.string().min(1).max(128),
  url: nullableText(2000),
  company: nullableText(200),
  title: nullableText(200),
  grade: z.enum(GRADES).nullish().catch(null),
  workFormat: z.enum(WORK_FORMATS).nullish().catch(null),
  salaryRaw: nullableText(200),
  salaryMin: z.number().int().nonnegative().nullish().catch(null),
  salaryMax: z.number().int().nonnegative().nullish().catch(null),
  salaryCurrency: nullableText(8),
  hardSkills: z.array(ImportHardSkillSchema).max(200).catch([]),
  softSkills: z.array(ImportSoftSkillSchema).max(100).catch([]),
  letter: z.string().max(40_000).catch(''),
  /** Epoch ms, as written by the old IndexedDB store. */
  createdAt: z.number().int().positive().nullish().catch(null),
});

export const ImportFileSchema = z.object({
  /** 1 had no contacts; 2 added them. Both import without special handling. */
  schemaVersion: z.number().int().positive().nullish().catch(null),
  // Unreadable entries are dropped here and counted as skipped by the service.
  vacancies: z.array(z.unknown()).max(20_000).catch([]),
  contacts: z
    .array(
      z.object({
        id: z.string().max(100).catch(''),
        label: z.string().max(60).catch(''),
        value: z.string().max(400).catch(''),
      }),
    )
    .max(50)
    .nullish()
    .catch([]),
  settings: z
    .object({
      cvText: z.string().max(100_000).nullish().catch(null),
      signature: z
        .object({
          enabled: z.boolean().catch(false),
          ru: z.string().max(500).catch(''),
          en: z.string().max(500).catch(''),
        })
        .nullish()
        .catch(null),
    })
    // Older files carry provider and model here too; those stay in the browser,
    // so they are simply ignored rather than described.
    .loose()
    .nullish()
    .catch(null),
});

export const ImportResultSchema = z.object({
  imported: z.number().int().nonnegative(),
  /** Duplicates by text hash, plus records too damaged to read. */
  skipped: z.number().int().nonnegative(),
  /**
   * Profile fields that were empty in the database and got their value from the
   * file. An import never overwrites something already entered, so a field
   * missing from this list means "kept what was there".
   */
  seededProfileFields: z.array(z.string()),
});

export type ImportVacancy = z.infer<typeof ImportVacancySchema>;
export type ImportFile = z.infer<typeof ImportFileSchema>;
export type ImportResult = z.infer<typeof ImportResultSchema>;
