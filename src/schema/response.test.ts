import { describe, expect, it } from 'vitest';
import { extractJson, parseModelResponse, responseJsonSchema } from './response';

const valid = {
  letter: 'Привет, делал похожие задачи на React.',
  companyRequirements: { found: false, mode: 'none', phrase: null, description: null },
  vacancy: { company: 'Acme', title: 'Frontend', grade: 'middle', workFormat: 'remote' },
  skills: {
    hard: [{ name: 'React', context: 'React + Next.js', required: true }],
    soft: [{ name: 'Communication', context: 'общение с заказчиком', required: false }],
  },
};

describe('extractJson', () => {
  it('parses a bare object', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it('unwraps a fenced code block', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('ignores prose around the object', () => {
    expect(extractJson('Вот результат:\n{"a":1}\nГотово.')).toEqual({ a: 1 });
  });

  it('repairs a trailing comma', () => {
    expect(extractJson('{"a":1,"b":[1,2,],}')).toEqual({ a: 1, b: [1, 2] });
  });

  it('throws on text with no object at all', () => {
    expect(() => extractJson('совсем не json')).toThrow();
  });
});

describe('parseModelResponse', () => {
  it('accepts a well-formed response', () => {
    const parsed = parseModelResponse(valid);
    expect(parsed.vacancy.company).toBe('Acme');
    expect(parsed.skills.hard[0]?.name).toBe('React');
  });

  it('accepts a JSON string as well as an object', () => {
    expect(parseModelResponse(JSON.stringify(valid)).letter).toBe(valid.letter);
  });

  it('degrades an unknown grade to null instead of failing', () => {
    const parsed = parseModelResponse({
      ...valid,
      vacancy: { ...valid.vacancy, grade: 'Principal', workFormat: 'Remote' },
    });
    expect(parsed.vacancy.grade).toBeNull();
    // ...but a known value in the wrong case is recovered, not dropped.
    expect(parsed.vacancy.workFormat).toBe('remote');
  });

  it('maps an unknown soft skill onto Other', () => {
    const parsed = parseModelResponse({
      ...valid,
      skills: { ...valid.skills, soft: [{ name: 'Vibes', context: 'хз', required: false }] },
    });
    expect(parsed.skills.soft[0]?.name).toBe('Other');
  });

  it('turns empty strings into nulls', () => {
    const parsed = parseModelResponse({
      ...valid,
      vacancy: { company: '   ', title: '', grade: null, workFormat: null },
    });
    expect(parsed.vacancy.company).toBeNull();
    expect(parsed.vacancy.title).toBeNull();
  });

  it('survives missing skills and requirements blocks', () => {
    const parsed = parseModelResponse({ letter: 'текст' });
    expect(parsed.skills.hard).toEqual([]);
    expect(parsed.skills.soft).toEqual([]);
    expect(parsed.companyRequirements.mode).toBe('none');
    expect(parsed.companyRequirements.found).toBe(false);
  });

  it('keeps the verbatim phrase for include_phrase mode', () => {
    const parsed = parseModelResponse({
      ...valid,
      companyRequirements: {
        found: true,
        mode: 'include_phrase',
        phrase: 'Банан',
        description: 'начните письмо со слова Банан',
      },
    });
    expect(parsed.companyRequirements.phrase).toBe('Банан');
  });

  it('rejects a payload with no letter at all', () => {
    expect(() => parseModelResponse({ vacancy: {} })).toThrow();
  });
});

describe('responseJsonSchema', () => {
  it('produces a draft-7 object schema with the documented top-level keys', () => {
    const schema = responseJsonSchema();
    expect(schema['type']).toBe('object');
    expect(Object.keys(schema['properties'] as object).sort()).toEqual([
      'companyRequirements',
      'letter',
      'skills',
      'vacancy',
    ]);
  });
});
