/** Letter length presets (TASK §6.2). */

export const LETTER_LENGTHS = ['short', 'medium', 'long'] as const;
export type LetterLength = (typeof LETTER_LENGTHS)[number];

export interface LengthPreset {
  readonly id: LetterLength;
  readonly label: string;
  readonly minWords: number;
  readonly maxWords: number;
}

export const LENGTH_PRESETS: Readonly<Record<LetterLength, LengthPreset>> = {
  short: { id: 'short', label: 'Короткое', minWords: 40, maxWords: 70 },
  medium: { id: 'medium', label: 'Среднее', minWords: 100, maxWords: 150 },
  long: { id: 'long', label: 'Длинное', minWords: 180, maxWords: 250 },
};

export const LETTER_LANGUAGES = ['ru', 'en', 'auto'] as const;
export type LetterLanguage = (typeof LETTER_LANGUAGES)[number];

export const LANGUAGE_LABELS: Readonly<Record<LetterLanguage, string>> = {
  ru: 'RU',
  en: 'EN',
  auto: 'Как в вакансии',
};

export const isLetterLength = (v: unknown): v is LetterLength =>
  typeof v === 'string' && (LETTER_LENGTHS as readonly string[]).includes(v);

export const isLetterLanguage = (v: unknown): v is LetterLanguage =>
  typeof v === 'string' && (LETTER_LANGUAGES as readonly string[]).includes(v);
