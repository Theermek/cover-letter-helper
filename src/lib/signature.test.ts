/**
 * The signature is appended by code, so the guarantees live here: never twice,
 * and the right template for a letter whose language the model chose.
 */

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SIGNATURES,
  appendSignature,
  detectLetterLanguage,
  resolveSignature,
} from './signature';

describe('appendSignature', () => {
  it('separates the signature from the letter with a blank line', () => {
    expect(appendSignature('Здравствуйте! Делал админки.', 'С уважением, Эрмек')).toBe(
      'Здравствуйте! Делал админки.\n\nС уважением, Эрмек',
    );
  });

  it('does not add a second copy to a letter that already ends with it', () => {
    const once = appendSignature('Письмо.', 'С уважением, Эрмек');

    expect(appendSignature(once, 'С уважением, Эрмек')).toBe(once);
  });

  it('ignores trailing whitespace when deciding whether it is already there', () => {
    expect(appendSignature('Письмо.\n\nС уважением, Эрмек\n\n  ', 'С уважением, Эрмек')).toBe(
      'Письмо.\n\nС уважением, Эрмек',
    );
  });

  it('leaves the letter untouched when the template is empty', () => {
    expect(appendSignature('Письмо.', '   ')).toBe('Письмо.');
  });

  it('returns just the signature when there is no letter', () => {
    expect(appendSignature('   ', 'С уважением, Эрмек')).toBe('С уважением, Эрмек');
  });
});

describe('detectLetterLanguage', () => {
  it('treats a Russian letter with English tech names as Russian', () => {
    expect(
      detectLetterLanguage('Последние три года пишу на React и TypeScript, стек Next.js.'),
    ).toBe('ru');
  });

  it('treats an English letter quoting a Russian company as English', () => {
    expect(detectLetterLanguage('I saw your opening at Яндекс and wanted to reach out.')).toBe(
      'en',
    );
  });

  it('falls back to English when there are no letters at all', () => {
    expect(detectLetterLanguage('   \n 42 ')).toBe('en');
  });
});

describe('resolveSignature', () => {
  it('follows an explicitly chosen language', () => {
    expect(resolveSignature(DEFAULT_SIGNATURES, 'en', 'Здравствуйте!')).toBe(
      DEFAULT_SIGNATURES.en,
    );
    expect(resolveSignature(DEFAULT_SIGNATURES, 'ru', 'Hi there!')).toBe(DEFAULT_SIGNATURES.ru);
  });

  it('detects the language from the letter when it was left on auto', () => {
    expect(resolveSignature(DEFAULT_SIGNATURES, 'auto', 'Здравствуйте! Делал админки.')).toBe(
      DEFAULT_SIGNATURES.ru,
    );
    expect(resolveSignature(DEFAULT_SIGNATURES, 'auto', 'Hi, I saw your opening.')).toBe(
      DEFAULT_SIGNATURES.en,
    );
  });
});
