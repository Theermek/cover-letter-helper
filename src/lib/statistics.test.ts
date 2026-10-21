import { describe, expect, it } from 'vitest';
import { LOW_SAMPLE_THRESHOLD, TOP_N, computeMarketStats } from './statistics';
import type { HardSkill, SoftSkill, VacancyRecord } from '../storage/types';

let seq = 0;

const vacancy = (hardSkills: HardSkill[], softSkills: SoftSkill[] = []): VacancyRecord => {
  seq += 1;
  return {
    id: `v${seq}`,
    createdAt: seq,
    updatedAt: seq,
    sourceText: `вакансия ${seq}`,
    textHash: `hash${seq}`,
    company: null,
    title: null,
    grade: null,
    workFormat: null,
    hardSkills,
    softSkills,
    letter: '',
  };
};

const hard = (name: string, context = name, required = true): HardSkill => ({
  name,
  context,
  required,
});

describe('computeMarketStats', () => {
  it('returns an empty, low-sample result for no vacancies', () => {
    const stats = computeMarketStats([]);
    expect(stats.totalVacancies).toBe(0);
    expect(stats.lowSample).toBe(true);
    expect(stats.hard).toEqual([]);
  });

  it('counts a skill once per vacancy however many times it is listed', () => {
    const stats = computeMarketStats([
      vacancy([hard('React', 'React'), hard('React', 'React hooks'), hard('React', 'React 18')]),
    ]);

    expect(stats.hard).toHaveLength(1);
    expect(stats.hard[0]?.vacancyCount).toBe(1);
    expect(stats.hard[0]?.percent).toBe(100);
  });

  it('merges aliases onto the canonical name across vacancies', () => {
    const stats = computeMarketStats([
      vacancy([hard('ReactJS')]),
      vacancy([hard('React.js')]),
      vacancy([hard('React')]),
      vacancy([hard('Vue')]),
    ]);

    const react = stats.hard.find((s) => s.name === 'React');
    expect(react?.vacancyCount).toBe(3);
    expect(react?.percent).toBe(75);
    expect(stats.hard.some((s) => s.name === 'ReactJS')).toBe(false);
  });

  it('computes required share among vacancies that mention the skill, not all', () => {
    const stats = computeMarketStats([
      vacancy([hard('React', 'React', true)]),
      vacancy([hard('React', 'React', false)]),
      vacancy([hard('Go')]),
      vacancy([hard('Go')]),
    ]);

    const react = stats.hard.find((s) => s.name === 'React');
    expect(react?.vacancyCount).toBe(2);
    // 1 of 2 mentions required -> 50%, not 1 of 4 vacancies.
    expect(react?.requiredPercent).toBe(50);
    expect(react?.percent).toBe(50);
  });

  it('treats a skill as required when any mention in that vacancy requires it', () => {
    const stats = computeMarketStats([
      vacancy([hard('React', 'желательно', false), hard('React', 'обязательно', true)]),
    ]);
    expect(stats.hard[0]?.requiredCount).toBe(1);
    expect(stats.hard[0]?.requiredPercent).toBe(100);
  });

  it('reports the most frequent wordings, at most three', () => {
    const stats = computeMarketStats([
      vacancy([hard('React', 'React + Next.js')]),
      vacancy([hard('React', 'react + next.js')]),
      vacancy([hard('React', 'React Native')]),
      vacancy([hard('React', 'React hooks')]),
      vacancy([hard('React', 'React 18')]),
    ]);

    const contexts = stats.hard[0]?.topContexts ?? [];
    expect(contexts).toHaveLength(3);
    // Case-insensitive grouping, original spelling preserved for display.
    expect(contexts[0]).toEqual({ text: 'React + Next.js', count: 2 });
  });

  it('flags a thin sample below the threshold and clears it at the threshold', () => {
    const few = Array.from({ length: LOW_SAMPLE_THRESHOLD - 1 }, () => vacancy([hard('React')]));
    expect(computeMarketStats(few).lowSample).toBe(true);

    const enough = Array.from({ length: LOW_SAMPLE_THRESHOLD }, () => vacancy([hard('React')]));
    expect(computeMarketStats(enough).lowSample).toBe(false);
  });

  it('limits each list to the top ten, ordered by vacancy count', () => {
    const vacancies = Array.from({ length: 15 }, (_, i) =>
      // Skill i appears in (15 - i) vacancies.
      vacancy(Array.from({ length: 15 - i }, (_, j) => hard(`Skill${j}`))),
    );

    const stats = computeMarketStats(vacancies);
    expect(stats.hard).toHaveLength(TOP_N);
    expect(stats.hard[0]?.name).toBe('Skill0');
    const counts = stats.hard.map((s) => s.vacancyCount);
    expect([...counts].sort((a, b) => b - a)).toEqual(counts);
  });

  it('labels soft skills in Russian while keeping the taxonomy key', () => {
    const stats = computeMarketStats([
      vacancy([], [{ name: 'Communication', context: 'общение с заказчиком', required: true }]),
    ]);

    expect(stats.soft[0]?.name).toBe('Communication');
    expect(stats.soft[0]?.label).toBe('Коммуникация');
  });

  it('ignores blank skill names and blank contexts', () => {
    const stats = computeMarketStats([vacancy([hard('   ', '  '), hard('React', '  ')])]);
    expect(stats.hard).toHaveLength(1);
    expect(stats.hard[0]?.topContexts).toEqual([]);
  });
});
