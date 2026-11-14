/**
 * Covers the stage-3 acceptance criteria (TASK §10): a vacancy asking for only
 * a code word must produce exactly that word at any chosen length, and a
 * vacancy asking for a verbatim opening must keep that phrase untouched by the
 * sanitizer.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installChromeStub } from '../ui/testing/chromeStub';
import { installFetchStub, type FetchStub } from '../api/testing/fetchStub';
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
  server: { url: 'http://localhost:3000', token: 'test-token' },
  provider: 'openai',
  apiKeys: { openai: 'sk-test' },
  models: { openai: 'gpt-4.1-mini' },
  fetchedModels: {},
  defaults: { language: 'ru', length: 'medium' },
};

/** The CV and the signature templates come from the server now (TASK2 §1.5). */
const profile = {
  cvText: 'React, TypeScript, три года.',
  signature: { enabled: false, ru: 'С уважением, Эрмек', en: 'Best regards, Ermek' },
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
  withSignature: false,
  ...over,
});

let server: FetchStub;

beforeEach(() => {
  vi.clearAllMocks();
  installChromeStub({ settings });
  server = installFetchStub(profile);
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

  it('sends the vacancy to the server with the analysis as the model gave it', async () => {
    generate.mockResolvedValue(response());
    const { startGeneration } = await import('./generation');

    await startGeneration(input());

    const save = server.calls.find((c) => c.method === 'POST' && c.url.endsWith('/vacancies'));
    expect(save?.body).toMatchObject({
      sourceText: 'Ищем React-разработчика',
      company: 'Acme',
      title: 'Frontend',
      // Not canonicalised here on purpose: normalisation lives on the server
      // with the statistics, so one dictionary serves old and new records alike.
      hardSkills: [{ name: 'ReactJS', context: 'React + Next.js', required: true }],
    });
    expect(save?.body).toHaveProperty('textHash');
  });

  it('sends an edited letter as a one-field PATCH', async () => {
    generate.mockResolvedValue(response());
    const { startGeneration, updateLetter } = await import('./generation');

    const state = await startGeneration(input());
    await updateLetter('письмо, поправленное руками');

    const patch = server.calls.find((c) => c.method === 'PATCH');
    expect(patch?.url).toContain(`/vacancies/${state.result?.vacancyId}`);
    expect(patch?.body).toEqual({ letter: 'письмо, поправленное руками' });
  });

  it('keeps the letter even when the server refuses to store the vacancy', async () => {
    generate.mockResolvedValue(response({ letter: 'Здравствуйте! Делал админки на React.' }));
    const { startGeneration } = await import('./generation');
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    // The archive is a side effect; losing it must not cost the user the letter
    // they just waited for.
    server.vacancies = { set: () => { throw new Error('db down'); } } as never;
    const state = await startGeneration(input());

    expect(state.status).toBe('done');
    expect(state.result?.letter).toBe('Здравствуйте! Делал админки на React.');
    expect(state.result?.vacancyId).toBeNull();
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
    installFetchStub({ ...profile, cvText: '   ' });
    const { startGeneration } = await import('./generation');

    const state = await startGeneration(input());

    expect(generate).not.toHaveBeenCalled();
    expect(state.status).toBe('error');
    expect(state.error?.message).toContain('Добавьте CV');
  });

  it('refuses to generate before onboarding is finished', async () => {
    installChromeStub({ settings: { ...settings, apiKeys: {} } });
    installFetchStub(profile);
    const { startGeneration } = await import('./generation');

    const state = await startGeneration(input());

    expect(generate).not.toHaveBeenCalled();
    expect(state.status).toBe('error');
  });

  it('appends the signature once, however many times the letter is regenerated', async () => {
    generate.mockResolvedValue(response({ letter: 'Здравствуйте! Делал админки на React.' }));
    const { startGeneration } = await import('./generation');

    const first = await startGeneration(input({ withSignature: true }));
    const second = await startGeneration(input({ withSignature: true }));

    expect(first.result?.letter).toBe('Здравствуйте! Делал админки на React.\n\nС уважением, Эрмек');
    expect(second.result?.letter).toBe(first.result?.letter);
  });

  it('picks the signature template by the language of the letter when set to auto', async () => {
    generate.mockResolvedValue(response({ letter: 'Hi, I saw your backend opening.' }));
    const { startGeneration } = await import('./generation');

    const state = await startGeneration(input({ language: 'auto', withSignature: true }));

    expect(state.result?.letter.endsWith('Best regards, Ermek')).toBe(true);
  });

  it('adds no signature when the company asked for the code word alone', async () => {
    generate.mockResolvedValue(
      response({
        letter: 'Здравствуйте! Хочу откликнуться...',
        companyRequirements: {
          found: true,
          mode: 'only_phrase',
          phrase: 'Банан',
          description: 'напишите только слово Банан',
        },
      }),
    );
    const { startGeneration } = await import('./generation');

    const state = await startGeneration(input({ withSignature: true }));

    expect(state.result?.letter).toBe('Банан');
  });

  it('leaves the letter alone when the checkbox is off', async () => {
    generate.mockResolvedValue(response({ letter: 'Здравствуйте! Делал админки на React.' }));
    const { startGeneration } = await import('./generation');

    const state = await startGeneration(input({ withSignature: false }));

    expect(state.result?.letter).toBe('Здравствуйте! Делал админки на React.');
  });

  it('tells the model not to sign only when the signature is switched on', async () => {
    generate.mockResolvedValue(response());
    const { startGeneration } = await import('./generation');

    await startGeneration(input({ withSignature: true }));
    const withOn = generate.mock.calls[0]?.[0] as { system: string; user: string };
    expect(withOn.system).toContain('подпись, прощание и своё имя в конце НЕ пиши');
    expect(withOn.user).toContain('Подпись: не пиши');

    vi.clearAllMocks();
    generate.mockResolvedValue(response());
    await startGeneration(input({ withSignature: false }));
    const withOff = generate.mock.calls[0]?.[0] as { system: string; user: string };
    expect(withOff.system).not.toContain('НЕ пиши');
    expect(withOff.user).not.toContain('Подпись: не пиши');
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
