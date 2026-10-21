/**
 * Post-processing of the generated letter (TASK §6.8).
 *
 * Everything here is deterministic code, not model instructions. A phrase the
 * company asked for verbatim is masked out before the rewrites run and restored
 * afterwards, so punctuation inside a code word is never "corrected".
 */

import { CHARACTER_REPLACEMENTS } from '../config/bannedPhrases';

const EMOJI = /\p{Extended_Pictographic}️?/gu;

/** A placeholder that survives the rewrites below unchanged. */
const MASK = `${String.fromCharCode(0)}PROTECTED${String.fromCharCode(0)}`;

const stripMarkdown = (text: string): string =>
  text
    // Fenced code blocks and inline code.
    .replace(/```[a-z]*\n?/gi, '')
    .replace(/`([^`]*)`/g, '$1')
    // Bold / italic / strikethrough, innermost first.
    .replace(/(\*\*\*|___)(\S(?:[\s\S]*?\S)?)\1/g, '$2')
    .replace(/(\*\*|__)(\S(?:[\s\S]*?\S)?)\1/g, '$2')
    .replace(/(\*|_)(\S(?:[\s\S]*?\S)?)\1/g, '$2')
    .replace(/~~(\S(?:[\s\S]*?\S)?)~~/g, '$1')
    // Headings and blockquotes at line starts.
    .replace(/^[ \t]*#{1,6}[ \t]+/gm, '')
    .replace(/^[ \t]*>[ \t]?/gm, '')
    // Bullet and numbered list markers -- the letter must be solid prose.
    .replace(/^[ \t]*[-*+][ \t]+/gm, '')
    .replace(/^[ \t]*\d+[.)][ \t]+/gm, '')
    // Links: keep the label, drop the target.
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');

const applyCharacterReplacements = (text: string): string =>
  CHARACTER_REPLACEMENTS.reduce((acc, [from, to]) => acc.split(from).join(to), text);

const normalizeWhitespace = (text: string): string =>
  text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

/**
 * Cleans a letter. `protectedPhrase`, when present, is restored byte-for-byte.
 *
 * Returns the cleaned text; callers that need the raw model output keep it
 * separately (the stored record holds the final letter).
 */
export const sanitizeLetter = (letter: string, protectedPhrase?: string | null): string => {
  const phrase = protectedPhrase?.trim();
  const hasPhrase = phrase !== undefined && phrase !== '' && letter.includes(phrase);

  let text = hasPhrase ? letter.split(phrase).join(MASK) : letter;

  text = stripMarkdown(text);
  text = applyCharacterReplacements(text);
  text = text.replace(EMOJI, '');
  text = normalizeWhitespace(text);

  return hasPhrase ? text.split(MASK).join(phrase) : text;
};

/** Rough word count used for the length hint shown next to the result. */
export const countWords = (text: string): number => {
  const matches = text.trim().match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu);
  return matches ? matches.length : 0;
};
