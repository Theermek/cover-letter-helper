/**
 * The statistics contract, shared by the server and the extension (TASK2 §1.3).
 *
 * The numbers are computed on the server now, but the page that displays them
 * still needs to know their shape, and to refuse a response that does not match
 * it. Hence a zod schema rather than a bare interface: the extension validates
 * what arrives instead of trusting it and rendering `undefined`.
 */

import { z } from 'zod';

export const ContextStatSchema = z.object({
  /** A wording the vacancies actually used for this skill. */
  text: z.string(),
  count: z.number().int().nonnegative(),
});

export const SkillStatSchema = z.object({
  /** Canonical skill name; for soft skills this is the taxonomy key. */
  name: z.string(),
  /** Russian display label (soft skills); equals `name` for hard skills. */
  label: z.string(),
  vacancyCount: z.number().int().nonnegative(),
  percent: z.number().int().nonnegative(),
  requiredCount: z.number().int().nonnegative(),
  /** Share of required mentions among vacancies that list this skill. */
  requiredPercent: z.number().int().nonnegative(),
  topContexts: z.array(ContextStatSchema),
});

export const MarketStatsSchema = z.object({
  totalVacancies: z.number().int().nonnegative(),
  /** True while the sample is too thin for the percentages to mean much. */
  lowSample: z.boolean(),
  hard: z.array(SkillStatSchema),
  soft: z.array(SkillStatSchema),
});

export type ContextStat = z.infer<typeof ContextStatSchema>;
export type SkillStat = z.infer<typeof SkillStatSchema>;
export type MarketStats = z.infer<typeof MarketStatsSchema>;
