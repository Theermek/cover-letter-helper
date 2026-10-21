/**
 * Covers the stage-3 acceptance criteria (TASK §10): a vacancy asking for only
 * a code word must produce exactly that word at any chosen length, and a
 * vacancy asking for a verbatim opening must keep that phrase untouched by the
 * sanitizer.
 */

import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installChromeStub } from '../ui/testing/chromeStub';
import { appError } from '../lib/errors';
import type { ParsedResponse } from '../schema/response';
import type { GenerationInput } from '../storage/generation';

const generate = vi.fn();

vi.mock('../providers', () => ({
  getProvider: () => ({
    id: 'openai',
    generate,
    validateKey: vi.fn(),
    listModels: vi.fn(),
  }),
}));

const settings = {
  provider: 'openai',
  apiKeys: { openai: 'sk-test' },
  models: { openai: 'gpt-4.1-mini' },
  fetchedModels: {},
  cvText: 'React, TypeScript, три года.',
  defaults: { language: 'ru', length: 'medium' },
};

const response = (over: Partial<ParsedResponse> = {}): ParsedResponse => ({
  letter: 'Здравствуйте! Делал админки на React.',
  companyRequirements: { found: false, mode: 'none', phrase: null, description: null },
  vacancy: { company: 'Acme', title: 'Frontend', grade: 'middle', workFormat: 'remote' },
  skills: {
    hard: [{ name: 'ReactJS', context: 'React + Next.js', required: true }],
    soft: [{ name: 'Communication', context: 'общение', required: false }],
  },
  ...over,
});

const input = (over: Partial<GenerationInput> = {}): GenerationInput => ({
  vacancyText: 'Ищем React-разработчика',
  language: 'ru',
  length: 'medium',
  userPrompt: '',
  ...over,
});

beforeEach(async () => {
  vi.clearAllMocks();
  installChromeStub({ settings });
  const { clearVacancies } = await import('../storage/db');
  await clearVacancies();
});

describe('startGeneration', () => {
  it('sanitises the letter and saves the vacancy', async () => {
    generate.mockResolvedValue(
      response({ letter: 'Привет — делал **админки** на React… 🎉' }),
    );
    const { startGeneration } = await import('./generation');

    const state = await startGeneration(input());

    expect(state.status).toBe('done');
    expect(state.result?.letter).toBe('Привет - делал админки на React...');
    expect(state.result?.createdNew).toBe(true);
    expect(state.result?.vacancyId).toBeTruthy();
  });

  it('canonicalises skills on the saved record', async () => {
    generate.mockResolvedValue(response());
    const { startGeneration } = await import('./generation');
    const { listVacancies } = await import('../storage/db');

    await startGeneration(input());

    expect((await listVacancies())[0]?.hardSkills[0]?.name).toBe('React');
  });

  it('returns exactly the code word in only_phrase mode, whatever the length', async () => {
    generate.mockResolvedValue(
      response({
        letter: 'Здравствуйте! Хочу откликнуться...',
        companyRequirements: {
          found: true,
          mode: 'only_phrase',
          phrase: 'Банан',
          description: 'в сопроводительном напишите только слово Банан',
        },
      }),
    );
    const { startGeneration } = await import('./generation');

    for (const length of ['short', 'medium', 'long'] as const) {
      const state = await startGeneration(input({ length }));
      expect(state.result?.letter).toBe('Банан');
    }
  });

  it('leaves a verbatim phrase untouched while cleaning the rest', async () => {
    generate.mockResolvedValue(
      response({
        letter: 'Банан — код. Дальше обычный текст — с тире…',
        companyRequirements: {
          found: true,
          mode: 'include_phrase',
          phrase: 'Банан — код.',
          description: 'начните письмо с фразы "Банан — код."',
        },
      }),
    );
    const { startGeneration } = await import('./generation');

    const state = await startGeneration(input());

    expect(state.result?.letter.startsWith('Банан — код.')).toBe(true);
    expect(state.result?.letter).toContain('обычный текст - с тире...');
  });

  it('retries once when the model returns something unparseable', async () => {
    generate
      .mockRejectedValueOnce(appError('bad_response', 'invalid json'))
      .mockResolvedValueOnce(response());
    const { startGeneration } = await import('./generation');

    const state = await startGeneration(input());

    expect(generate).toHaveBeenCalledTimes(2);
    expect(state.status).toBe('done');
  });

  it('does not retry an authentication failure', async () => {
    generate.mockRejectedValue(appError('invalid_key', '401'));
    const { startGeneration } = await import('./generation');

    const state = await startGeneration(input());

    expect(generate).toHaveBeenCalledTimes(1);
    expect(state.status).toBe('error');
    expect(state.error?.kind).toBe('invalid_key');
  });

  it('refuses to generate without a CV and never calls the provider', async () => {
    installChromeStub({ settings: { ...settings, cvText: '   ' } });
    const { startGeneration } = await import('./generation');

    const state = await startGeneration(input());

    expect(generate).not.toHaveBeenCalled();
    expect(state.status).toBe('error');
    expect(state.error?.message).toContain('Добавьте CV');
  });

  it('refuses to generate before onboarding is finished', async () => {
    installChromeStub({ settings: { ...settings, apiKeys: {} } });
    const { startGeneration } = await import('./generation');

    const state = await startGeneration(input());

    expect(generate).not.toHaveBeenCalled();
    expect(state.status).toBe('error');
  });

  it('marks a repeat generation as an update rather than a new record', async () => {
    generate.mockResolvedValue(response());
    const { startGeneration } = await import('./generation');

    const first = await startGeneration(input());
    const second = await startGeneration(input());

    expect(first.result?.createdNew).toBe(true);
    expect(second.result?.createdNew).toBe(false);
    expect(second.result?.vacancyId).toBe(first.result?.vacancyId);
  });
});
