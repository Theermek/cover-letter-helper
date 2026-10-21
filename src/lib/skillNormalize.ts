/**
 * Skill normalisation (TASK §7.1).
 *
 * The model is asked to emit canonical names, and this is the safety net behind
 * it. Crucially it runs on READ as well as on write: extending the alias
 * dictionary then also improves statistics over vacancies saved earlier, which
 * would not happen if names were frozen at insert time.
 *
 * Within one vacancy a skill is collapsed to a single entry. Statistics count
 * vacancies, not mentions, so a model that lists "React" three times must not
 * weigh three times as much.
 */

import { canonicalSkillName } from '../config/skillAliases';
import type { HardSkill, SoftSkill } from '../storage/types';

interface SkillLike {
  name: string;
  context: string;
  required: boolean;
}

const dedupe = <T extends SkillLike>(skills: readonly T[]): T[] => {
  const byName = new Map<string, T>();

  for (const skill of skills) {
    const name = skill.name.trim();
    if (!name) continue;

    const key = name.toLowerCase();
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, { ...skill, name });
      continue;
    }

    // Keep the richer context, and treat the skill as required if any
    // mention said so -- "required somewhere" is the honest reading.
    byName.set(key, {
      ...existing,
      context: existing.context.length >= skill.context.length ? existing.context : skill.context,
      required: existing.required || skill.required,
    });
  }

  return [...byName.values()];
};

/** Canonicalises hard-skill names and collapses duplicates within one vacancy. */
export const normalizeHardSkills = (skills: readonly HardSkill[]): HardSkill[] =>
  dedupe(
    skills.map((skill) => ({
      ...skill,
      name: canonicalSkillName(skill.name),
      context: skill.context.trim(),
    })),
  );

/** Soft skills already come from a fixed taxonomy; only duplicates need work. */
export const normalizeSoftSkills = (skills: readonly SoftSkill[]): SoftSkill[] =>
  dedupe(skills.map((skill) => ({ ...skill, context: skill.context.trim() })));
