/**
 * Market statistics over saved vacancies (TASK §8).
 *
 * Pure code, no LLM call. The counting rules the task description left open are
 * fixed here:
 *  - a skill counts ONCE per vacancy, however many times the model listed it;
 *  - percent = vacancies mentioning the skill / all saved vacancies;
 *  - "how often required" = share of required:true among the vacancies that
 *    mention the skill (not among all vacancies);
 *  - alias canonicalisation is applied here, on read, so older records benefit
 *    from a newer dictionary.
 */

import { normalizeHardSkills, normalizeSoftSkills } from './skillNormalize';
import { SOFT_SKILL_LABELS, type SoftSkillCategory } from '../config/softSkills';
import type { VacancyRecord } from '../storage/types';

/** Below this many vacancies the UI warns that the sample is thin. */
export const LOW_SAMPLE_THRESHOLD = 10;
export const TOP_N = 10;
const MAX_CONTEXTS = 3;

export interface ContextStat {
  text: string;
  count: number;
}

export interface SkillStat {
  /** Canonical skill name; for soft skills this is the taxonomy key. */
  name: string;
  /** Russian display label (soft skills); equals `name` for hard skills. */
  label: string;
  vacancyCount: number;
  percent: number;
  requiredCount: number;
  /** Share of required mentions among vacancies that list this skill. */
  requiredPercent: number;
  topContexts: ContextStat[];
}

export interface MarketStats {
  totalVacancies: number;
  lowSample: boolean;
  hard: SkillStat[];
  soft: SkillStat[];
}

interface Accumulator {
  name: string;
  vacancyCount: number;
  requiredCount: number;
  /** Lowercased context -> { display form, count }. */
  contexts: Map<string, ContextStat>;
}

const percent = (part: number, whole: number): number =>
  whole === 0 ? 0 : Math.round((part / whole) * 100);

const addContext = (acc: Accumulator, raw: string): void => {
  const text = raw.trim().replace(/\s+/g, ' ');
  if (!text) return;

  const key = text.toLowerCase();
  const existing = acc.contexts.get(key);
  acc.contexts.set(key, { text: existing?.text ?? text, count: (existing?.count ?? 0) + 1 });
};

const topContexts = (acc: Accumulator): ContextStat[] =>
  [...acc.contexts.values()]
    .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text, 'ru'))
    .slice(0, MAX_CONTEXTS);

const rank = (
  accumulators: Map<string, Accumulator>,
  total: number,
  label: (name: string) => string,
): SkillStat[] =>
  [...accumulators.values()]
    .map((acc) => ({
      name: acc.name,
      label: label(acc.name),
      vacancyCount: acc.vacancyCount,
      percent: percent(acc.vacancyCount, total),
      requiredCount: acc.requiredCount,
      requiredPercent: percent(acc.requiredCount, acc.vacancyCount),
      topContexts: topContexts(acc),
    }))
    .sort(
      (a, b) =>
        b.vacancyCount - a.vacancyCount ||
        b.requiredCount - a.requiredCount ||
        a.name.localeCompare(b.name, 'ru'),
    )
    .slice(0, TOP_N);

export const computeMarketStats = (vacancies: readonly VacancyRecord[]): MarketStats => {
  const hard = new Map<string, Accumulator>();
  const soft = new Map<string, Accumulator>();

  const touch = (map: Map<string, Accumulator>, name: string): Accumulator => {
    const key = name.toLowerCase();
    const existing = map.get(key);
    if (existing) return existing;
    const created: Accumulator = {
      name,
      vacancyCount: 0,
      requiredCount: 0,
      contexts: new Map(),
    };
    map.set(key, created);
    return created;
  };

  for (const vacancy of vacancies) {
    // Normalising here (not only at write time) is what lets an updated alias
    // dictionary retro-fix records that were saved with a raw name.
    for (const skill of normalizeHardSkills(vacancy.hardSkills)) {
      const acc = touch(hard, skill.name);
      acc.vacancyCount += 1;
      if (skill.required) acc.requiredCount += 1;
      addContext(acc, skill.context);
    }

    for (const skill of normalizeSoftSkills(vacancy.softSkills)) {
      const acc = touch(soft, skill.name);
      acc.vacancyCount += 1;
      if (skill.required) acc.requiredCount += 1;
      addContext(acc, skill.context);
    }
  }

  const total = vacancies.length;
  return {
    totalVacancies: total,
    lowSample: total < LOW_SAMPLE_THRESHOLD,
    hard: rank(hard, total, (name) => name),
    soft: rank(soft, total, (name) => SOFT_SKILL_LABELS[name as SoftSkillCategory] ?? name),
  };
};
