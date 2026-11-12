/**
 * The humanizer rules are prompt text, so what can be tested is the wiring and
 * the invariants that keep the prompt coherent: the block is actually sent, it
 * does not contradict the JSON-only contract, and the cliche lists stay clean.
 */

import { describe, expect, it } from 'vitest';
import { HUMANIZER_RULES } from './humanizer';
import { buildSystemPrompt } from './system';
import { BANNED_PHRASES, BANNED_PHRASES_EN, BANNED_PHRASES_RU } from '../config/bannedPhrases';

describe('HUMANIZER_RULES', () => {
  it('is part of the system prompt in both signature modes', () => {
    for (const withSignature of [true, false]) {
      expect(buildSystemPrompt({ withSignature })).toContain(HUMANIZER_RULES);
    }
  });

  it('keeps honesty above style, so "add a voice" cannot license invention', () => {
    expect(HUMANIZER_RULES).toContain('слабее честности');
    expect(HUMANIZER_RULES).toContain('не даёт права выдумывать');
  });

  it('does not ask for a draft or a visible analysis pass', () => {
    // The skill's own output format would break the single-JSON-object contract.
    expect(HUMANIZER_RULES).not.toMatch(/черновой вариант|финальная версия|формат вывода/i);
  });

  it('covers the patterns the rest of the prompt does not', () => {
    for (const marker of ['ДЕЕПРИЧАСТНЫЕ ХВОСТЫ', 'ТРИАДЫ', 'ХЕДЖИРОВАНИЕ', 'ПАССИВ']) {
      expect(HUMANIZER_RULES).toContain(marker);
    }
  });
});

describe('banned phrases', () => {
  it('has no duplicates within or across the languages', () => {
    expect(new Set(BANNED_PHRASES_RU).size).toBe(BANNED_PHRASES_RU.length);
    expect(new Set(BANNED_PHRASES_EN).size).toBe(BANNED_PHRASES_EN.length);
    expect(new Set(BANNED_PHRASES).size).toBe(BANNED_PHRASES.length);
  });

  it('lists every phrase in the system prompt', () => {
    const prompt = buildSystemPrompt({ withSignature: false });
    for (const phrase of BANNED_PHRASES) expect(prompt).toContain(phrase);
  });
});
