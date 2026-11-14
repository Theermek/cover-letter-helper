import { describe, expect, it } from 'vitest';
import { normalizeHardSkills, normalizeSoftSkills } from './skillNormalize.js';
import { canonicalSkillName } from './skillAliases.js';

describe('canonicalSkillName', () => {
  it('maps known aliases onto the canonical spelling', () => {
    expect(canonicalSkillName('ReactJS')).toBe('React');
    expect(canonicalSkillName('react.js')).toBe('React');
    expect(canonicalSkillName('TS')).toBe('TypeScript');
    expect(canonicalSkillName('postgres')).toBe('PostgreSQL');
    expect(canonicalSkillName('k8s')).toBe('Kubernetes');
  });

  it('keeps names it does not know, only trimming them', () => {
    expect(canonicalSkillName('  Elixir ')).toBe('Elixir');
  });

  it('does not mangle names that contain punctuation', () => {
    expect(canonicalSkillName('C++')).toBe('C++');
    expect(canonicalSkillName('C#')).toBe('C#');
  });

  it('returns an empty string for blank input', () => {
    expect(canonicalSkillName('   ')).toBe('');
  });
});

describe('normalizeHardSkills', () => {
  it('canonicalises and collapses duplicates within one vacancy', () => {
    const result = normalizeHardSkills([
      { name: 'ReactJS', context: 'React', required: false },
      { name: 'React.js', context: 'React + Next.js', required: true },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('React');
    // The richer wording wins, and "required anywhere" means required.
    expect(result[0]?.context).toBe('React + Next.js');
    expect(result[0]?.required).toBe(true);
  });

  it('drops entries with a blank name', () => {
    const result = normalizeHardSkills([
      { name: '  ', context: 'ничего', required: true },
      { name: 'Go', context: 'Go 1.22', required: true },
    ]);
    expect(result.map((s) => s.name)).toEqual(['Go']);
  });

  it('keeps distinct skills apart', () => {
    const result = normalizeHardSkills([
      { name: 'React', context: '', required: true },
      { name: 'Vue', context: '', required: false },
    ]);
    expect(result).toHaveLength(2);
  });

  it('trims surrounding whitespace in contexts', () => {
    const result = normalizeHardSkills([{ name: 'Go', context: '  Go 1.22  ', required: true }]);
    expect(result[0]?.context).toBe('Go 1.22');
  });
});

describe('normalizeSoftSkills', () => {
  it('collapses repeats of the same category', () => {
    const result = normalizeSoftSkills([
      { name: 'Communication', context: 'общение', required: false },
      { name: 'Communication', context: 'общение с заказчиком', required: true },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.context).toBe('общение с заказчиком');
    expect(result[0]?.required).toBe(true);
  });
});
