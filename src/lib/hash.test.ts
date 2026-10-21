import { describe, expect, it } from 'vitest';
import { normalizeForHash, sha256Hex, vacancyTextHash } from './hash';

describe('normalizeForHash', () => {
  it('folds case, punctuation and whitespace into a single form', () => {
    expect(normalizeForHash('React,  Node.js!\n\nSenior')).toBe('react node js senior');
  });

  it('treats typographic quotes and dashes as their plain equivalents', () => {
    expect(normalizeForHash('“React” — ‘Vue’')).toBe('react vue');
  });

  it('ignores leading and trailing noise', () => {
    expect(normalizeForHash('   ...React...   ')).toBe('react');
  });
});

describe('vacancyTextHash', () => {
  it('gives the same hash to the same vacancy copied with different formatting', async () => {
    const a = await vacancyTextHash('Ищем Frontend-разработчика.\nReact, TypeScript.');
    const b = await vacancyTextHash('  ищем   frontend разработчика!!  react;  typescript  ');
    expect(a).toBe(b);
  });

  it('gives different hashes to different vacancies', async () => {
    const a = await vacancyTextHash('Frontend, React');
    const b = await vacancyTextHash('Backend, Go');
    expect(a).not.toBe(b);
  });

  it('produces a 64-character hex digest', async () => {
    expect(await sha256Hex('x')).toMatch(/^[0-9a-f]{64}$/);
  });
});
