/**
 * Fixed vocabularies shared by the server and the extension (TASK2 §1.2).
 *
 * These lists are the reason statistics are comparable at all: grade, work
 * format and soft-skill category are closed sets, so counting them is counting
 * like with like. They live in shared/ because both sides need the same values
 * -- the model schema that produces them and the database that stores them must
 * not be allowed to drift apart.
 */

export const GRADES = ['junior', 'middle', 'senior', 'lead'] as const;
export const WORK_FORMATS = ['remote', 'office', 'hybrid'] as const;
export const REQUIREMENT_MODES = ['include_phrase', 'only_phrase', 'none'] as const;

export type Grade = (typeof GRADES)[number];
export type WorkFormat = (typeof WORK_FORMATS)[number];
export type RequirementMode = (typeof REQUIREMENT_MODES)[number];

/**
 * The model must map every soft skill it finds onto one of these categories;
 * the original wording is kept separately in the skill's `context` field.
 */
export const SOFT_SKILL_CATEGORIES = [
  'Communication',
  'Teamwork',
  'Responsibility',
  'Self-organization',
  'Problem solving',
  'Learning ability',
  'Proactivity',
  'Attention to detail',
  'Time management',
  'Stress resistance',
  'Leadership',
  'Mentoring',
  'Other',
] as const;

export type SoftSkillCategory = (typeof SOFT_SKILL_CATEGORIES)[number];

/** Russian labels for display only -- storage and statistics use the English key. */
export const SOFT_SKILL_LABELS: Readonly<Record<SoftSkillCategory, string>> = {
  Communication: 'Коммуникация',
  Teamwork: 'Работа в команде',
  Responsibility: 'Ответственность',
  'Self-organization': 'Самоорганизация',
  'Problem solving': 'Решение проблем',
  'Learning ability': 'Обучаемость',
  Proactivity: 'Проактивность',
  'Attention to detail': 'Внимание к деталям',
  'Time management': 'Тайм-менеджмент',
  'Stress resistance': 'Стрессоустойчивость',
  Leadership: 'Лидерство',
  Mentoring: 'Наставничество',
  Other: 'Другое',
};

export const isSoftSkillCategory = (v: unknown): v is SoftSkillCategory =>
  typeof v === 'string' && (SOFT_SKILL_CATEGORIES as readonly string[]).includes(v);
