/**
 * Orchestrates one generation (TASK §6, §7).
 *
 * Runs entirely in the service worker: the popup may close at any moment, so
 * the state machine and the persisted result live here, not in the UI.
 */

import { getProvider } from '../providers';
import { buildSystemPrompt } from '../prompts/system';
import { buildUserPrompt } from '../prompts/buildUserPrompt';
import { AppError, appError, toAppError } from '../lib/errors';
import { sanitizeLetter } from '../lib/sanitizer';
import { appendSignature, resolveSignature } from '../lib/signature';
import { vacancyTextHash } from '../lib/hash';
import { activeConfig, getSettings } from '../storage/settings';
import { fetchProfile } from '../api/profile';
import { patchVacancy, saveVacancy } from '../api/vacancies';
import {
  getGenerationState,
  setGenerationState,
  type GenerationInput,
  type GenerationState,
} from '../storage/generation';
import type { ParsedResponse } from '../schema/response';

/** Guards against two popups firing a generation at the same time. */
let inFlight: Promise<GenerationState> | null = null;

/**
 * Applies the company's letter requirements (TASK §6.4) and then the sanitizer
 * (TASK §6.8). The verbatim phrase is never rewritten.
 */
const finalizeLetter = (parsed: ParsedResponse): string => {
  const { mode, phrase } = parsed.companyRequirements;

  if (mode === 'only_phrase') {
    // The answer is the phrase and nothing else -- no sanitising, since any
    // "correction" would corrupt a code word the company matches exactly.
    const exact = phrase?.trim();
    return exact ? exact : parsed.letter.trim();
  }

  return sanitizeLetter(parsed.letter, mode === 'include_phrase' ? phrase : null);
};

const isMalformedResponse = (error: unknown): boolean =>
  error instanceof AppError
    ? error.kind === 'bad_response'
    : // A zod/JSON failure that escaped the adapter is the same situation.
      error instanceof Error && /json|parse|invalid|schema/i.test(error.message);

const run = async (input: GenerationInput): Promise<GenerationState> => {
  const startedAt = Date.now();
  await setGenerationState({
    status: 'running',
    input,
    result: null,
    error: null,
    startedAt,
  });

  try {
    const vacancyText = input.vacancyText.trim();
    if (!vacancyText) throw appError('unknown', 'empty vacancy text');

    const settings = await getSettings();
    const config = activeConfig(settings);
    if (!config) {
      throw new AppError(
        'invalid_key',
        'Сначала выберите провайдера и введите API-ключ в настройках.',
      );
    }
    // The CV and the signature templates live on the server now (TASK2 §1.5).
    // A failure here is a real failure: generating from an empty CV would
    // silently produce a letter with no facts in it.
    const profile = await fetchProfile();
    if (!profile.cvText.trim()) {
      throw new AppError('unknown', 'Добавьте CV в настройках, без него письмо не сгенерировать.');
    }

    const provider = getProvider(config.provider);
    const params = {
      system: buildSystemPrompt({ withSignature: input.withSignature }),
      user: buildUserPrompt({
        vacancyText,
        cvText: profile.cvText,
        language: input.language,
        length: input.length,
        userPrompt: input.userPrompt,
        withSignature: input.withSignature,
      }),
      model: config.model,
      apiKey: config.apiKey,
    };

    // One automatic retry when the model returns something unparseable
    // (TASK §6.7); anything else fails straight away.
    let parsed: ParsedResponse;
    try {
      parsed = await provider.generate(params);
    } catch (error) {
      if (!isMalformedResponse(error)) throw error;
      parsed = await provider.generate(params);
    }

    // The signature goes on after the sanitizer and before storage, so the
    // field, the clipboard and the saved record all hold the same text. Never
    // in only_phrase mode: the company asked for the code word and nothing else.
    const sanitized = finalizeLetter(parsed);
    const letter =
      input.withSignature && parsed.companyRequirements.mode !== 'only_phrase'
        ? appendSignature(
            sanitized,
            resolveSignature(
              { enabled: true, ru: profile.signature.ru, en: profile.signature.en },
              input.language,
              sanitized,
            ),
          )
        : sanitized;

    let vacancyId: string | null = null;
    let createdNew = false;
    try {
      // The vacancy is stored on the server now (TASK2 §1.3); deduplication by
      // text hash happens there, enforced by a unique index.
      const saved = await saveVacancy({
        sourceText: vacancyText,
        textHash: await vacancyTextHash(vacancyText),
        company: parsed.vacancy.company,
        title: parsed.vacancy.title,
        grade: parsed.vacancy.grade,
        workFormat: parsed.vacancy.workFormat,
        hardSkills: parsed.skills.hard,
        softSkills: parsed.skills.soft,
        letter,
      });
      vacancyId = saved.vacancy.id;
      createdNew = saved.created;
    } catch (error) {
      // A storage failure must not cost the user their letter: it is already in
      // the generation state and on screen, only the archive entry is missing.
      console.warn('[cover-letter] не удалось сохранить вакансию', error);
    }

    const state: GenerationState = {
      status: 'done',
      input,
      result: {
        letter,
        companyRequirements: parsed.companyRequirements,
        company: parsed.vacancy.company,
        title: parsed.vacancy.title,
        grade: parsed.vacancy.grade,
        workFormat: parsed.vacancy.workFormat,
        vacancyId,
        createdNew,
        finishedAt: Date.now(),
      },
      error: null,
      startedAt,
    };

    await setGenerationState(state);
    return state;
  } catch (error) {
    const appErr = toAppError(error);
    const state: GenerationState = {
      status: 'error',
      input,
      result: null,
      error: appErr.toShape(),
      startedAt,
    };
    await setGenerationState(state);
    return state;
  }
};

export const startGeneration = async (input: GenerationInput): Promise<GenerationState> => {
  if (inFlight) return inFlight;

  inFlight = run(input).finally(() => {
    inFlight = null;
  });
  return inFlight;
};

export const resetGeneration = async (): Promise<GenerationState> => {
  const current = await getGenerationState();
  // Keep the last input so the form is not cleared under the user.
  const state: GenerationState = {
    status: 'idle',
    input: current.input,
    result: null,
    error: null,
    startedAt: null,
  };
  await setGenerationState(state);
  return state;
};

/** Persists a letter the user edited by hand, in state and in the DB record. */
export const updateLetter = async (letter: string): Promise<void> => {
  const current = await getGenerationState();
  if (current.status !== 'done' || !current.result) return;

  await setGenerationState({
    ...current,
    result: { ...current.result, letter },
  });

  const id = current.result.vacancyId;
  if (!id) return;

  try {
    // One PATCH with one field: the server keeps everything else as it is.
    await patchVacancy(id, { letter });
  } catch (error) {
    // The edit is already saved in the generation state, so the user does not
    // lose it; only the stored copy is behind.
    console.warn('[cover-letter] не удалось сохранить правку письма', error);
  }
};
