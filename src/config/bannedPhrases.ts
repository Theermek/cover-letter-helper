/**
 * Clichés the letter must avoid (TASK §6.5). These are fed to the prompt as a
 * "do not write this" list; the sanitizer does NOT delete them, because cutting
 * a phrase mid-sentence would produce broken text. Keeping them out is the
 * model's job -- this list exists so it can be extended without touching prompts.
 */

export const BANNED_PHRASES_RU: readonly string[] = [
  'с огромным энтузиазмом',
  'идеально соответствую',
  'динамично развивающаяся компания',
  'я уверен, что стану ценным членом команды',
  'хочу внести свой вклад',
  'считаю себя целеустремлённым',
  'имею большой опыт работы в данной сфере',
  'надеюсь на положительный ответ',
  'буду рад возможности обсудить',
  'данная вакансия меня очень заинтересовала',
];

export const BANNED_PHRASES_EN: readonly string[] = [
  'passionate',
  'thrilled',
  'leverage',
  'I am writing to express my interest',
  'synergy',
  'perfect fit',
  'dynamic environment',
  'proven track record',
  'I would be a valuable asset',
  'hit the ground running',
  'delve',
  'tapestry',
];

export const BANNED_PHRASES: readonly string[] = [...BANNED_PHRASES_RU, ...BANNED_PHRASES_EN];

/**
 * Characters people rarely type by hand (TASK §6.5/§6.8). Replacements are
 * applied by the sanitizer; the list is here so prompt and sanitizer agree.
 */
export const CHARACTER_REPLACEMENTS: readonly (readonly [string, string])[] = [
  ['—', '-'], // em dash
  ['–', '-'], // en dash
  ['−', '-'], // minus sign
  ['…', '...'], // horizontal ellipsis
  [' ', ' '], // non-breaking space
  ['’', "'"], // right single quote
  ['‘', "'"],
  ['“', '"'],
  ['”', '"'],
];
