/**
 * The signature appended to a finished letter (TASK2 §0.3).
 *
 * Deliberately code, not a model instruction: a signature is fixed text the
 * user owns, and asking an LLM to reproduce it verbatim every time is a worse
 * guarantee than string concatenation. The model is told not to sign at all.
 */

import type { LetterLanguage } from '../config/lengths';
import { DEFAULT_SIGNATURE_EN, DEFAULT_SIGNATURE_RU } from '../../shared/defaults';

export interface SignatureTemplates {
  enabled: boolean;
  ru: string;
  en: string;
}

export const DEFAULT_SIGNATURES: SignatureTemplates = {
  enabled: false,
  ru: DEFAULT_SIGNATURE_RU,
  en: DEFAULT_SIGNATURE_EN,
};

const CYRILLIC = /\p{Script=Cyrillic}/gu;
const LETTERS = /\p{L}/gu;

/** Share of Cyrillic above this counts as a Russian letter. */
const RU_THRESHOLD = 0.3;

/**
 * Which signature fits a letter whose language the user left to the model
 * ("auto"). A share rather than a first-character check, because a Russian
 * letter routinely contains English words (React, Kubernetes) and an English
 * one may quote a Russian company name.
 */
export const detectLetterLanguage = (letter: string): 'ru' | 'en' => {
  const letters = letter.match(LETTERS)?.length ?? 0;
  if (letters === 0) return 'en';

  const cyrillic = letter.match(CYRILLIC)?.length ?? 0;
  return cyrillic / letters > RU_THRESHOLD ? 'ru' : 'en';
};

/** The template to use for a letter generated with `requested` language. */
export const resolveSignature = (
  templates: SignatureTemplates,
  requested: LetterLanguage,
  letter: string,
): string => {
  const language = requested === 'auto' ? detectLetterLanguage(letter) : requested;
  return templates[language];
};

/**
 * Appends the signature once. Idempotent on purpose: regenerating a letter and
 * editing one by hand both run through here, and a letter that already ends
 * with the signature must not collect a second copy.
 */
export const appendSignature = (letter: string, signature: string): string => {
  const body = letter.trim();
  const sign = signature.trim();

  if (sign === '') return body;
  if (body === '') return sign;
  if (body.endsWith(sign)) return body;

  return `${body}\n\n${sign}`;
};
