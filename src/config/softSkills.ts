/**
 * Fixed soft-skill taxonomy (TASK §7.1).
 *
 * The vocabulary itself moved to `shared/` in TASK2 §1.2: the server counts
 * these categories and the extension displays them, so a single definition is
 * the only way the two cannot disagree. This file stays as the import path the
 * rest of the extension already uses.
 */

export {
  SOFT_SKILL_CATEGORIES,
  SOFT_SKILL_LABELS,
  isSoftSkillCategory,
  type SoftSkillCategory,
} from '../../shared/vocabulary';
