/**
 * Fixed soft-skill taxonomy (TASK §7.1). The model must map every soft skill it
 * finds onto one of these categories so that statistics stay comparable; the
 * original wording is kept separately in the skill's `context` field.
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
