import { describe, expect, it } from 'vitest';
import { countWords, sanitizeLetter } from './sanitizer';

describe('sanitizeLetter', () => {
  it('replaces characters people rarely type', () => {
    const out = sanitizeLetter('Я делал API — и тесты… вот так–так');
    expect(out).toBe("Я делал API - и тесты... вот так-так");
  });

  it('strips markdown emphasis, headings and list markers', () => {
    const out = sanitizeLetter('# Привет\n\n**Жирный** и *курсив*\n- пункт один\n1. пункт два');
    expect(out).toBe('Привет\n\nЖирный и курсив\nпункт один\nпункт два');
  });

  it('keeps the label of a markdown link and drops the target', () => {
    expect(sanitizeLetter('смотрите [мой гитхаб](https://example.com)')).toBe(
      'смотрите мой гитхаб',
    );
  });

  it('removes emoji', () => {
    expect(sanitizeLetter('Привет 👋 рад писать 🎉')).toBe('Привет рад писать');
  });

  it('collapses runaway whitespace and blank lines', () => {
    expect(sanitizeLetter('Первый   абзац\n\n\n\nВторой    абзац   ')).toBe(
      'Первый абзац\n\nВторой абзац',
    );
  });

  it('leaves a protected phrase byte-for-byte intact', () => {
    const phrase = 'Банан — *вкусный* 🍌';
    const letter = `Здравствуйте… ${phrase} Готов обсудить — спасибо.`;
    const out = sanitizeLetter(letter, phrase);

    expect(out).toContain(phrase);
    // ...while the rest of the letter is still cleaned up.
    expect(out).toContain('Здравствуйте...');
    expect(out).toContain('обсудить - спасибо');
  });

  it('protects every occurrence of the phrase', () => {
    const phrase = 'код—слово';
    const out = sanitizeLetter(`${phrase} и снова ${phrase} — конец`, phrase);
    expect(out).toBe(`${phrase} и снова ${phrase} - конец`);
  });

  it('is a no-op for a phrase that is not present in the letter', () => {
    expect(sanitizeLetter('обычный текст —', 'отсутствует')).toBe('обычный текст -');
  });

  it('ignores an empty protected phrase', () => {
    expect(sanitizeLetter('текст —', '  ')).toBe('текст -');
  });
});

describe('countWords', () => {
  it('counts words in mixed-script text', () => {
    expect(countWords('Я писал React и TypeScript')).toBe(5);
  });

  it('does not count punctuation as words', () => {
    expect(countWords('Привет, мир! - да.')).toBe(3);
  });

  it('returns 0 for empty input', () => {
    expect(countWords('   ')).toBe(0);
  });
});
