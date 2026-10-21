/**
 * Generation state, owned by the service worker and persisted.
 *
 * A popup closes the moment the user clicks outside it, while a generation runs
 * for 10-30 seconds. Keeping the state here (rather than in React state) means
 * the request survives the popup, the result is still there when it reopens,
 * and the full-size editor sees exactly the same thing.
 *
 * UI subscribes through chrome.storage.onChanged, so no long-lived port is
 * needed and a sleeping service worker cannot drop an update.
 */

import type { AppErrorShape } from '../lib/errors';
import type { LetterLanguage, LetterLength } from '../config/lengths';
import type { CompanyRequirements } from './types';
import type { Grade, WorkFormat } from '../schema/response';

const GENERATION_KEY = 'generation';
const PENDING_KEY = 'pendingVacancy';

export interface GenerationInput {
  vacancyText: string;
  language: LetterLanguage;
  length: LetterLength;
  userPrompt: string;
}

export interface GenerationResult {
  letter: string;
  companyRequirements: CompanyRequirements;
  company: string | null;
  title: string | null;
  grade: Grade | null;
  workFormat: WorkFormat | null;
  /** The saved record, so the UI can link to it; null if saving failed. */
  vacancyId: string | null;
  /** False when a repeat generation refreshed an existing record. */
  createdNew: boolean;
  finishedAt: number;
}

export type GenerationStatus = 'idle' | 'running' | 'done' | 'error';

export interface GenerationState {
  status: GenerationStatus;
  input: GenerationInput | null;
  result: GenerationResult | null;
  error: AppErrorShape | null;
  startedAt: number | null;
}

export const IDLE_STATE: GenerationState = {
  status: 'idle',
  input: null,
  result: null,
  error: null,
  startedAt: null,
};

/**
 * A generation older than this is treated as abandoned: the worker was killed
 * mid-request, so the UI must not sit on a spinner forever.
 */
const STALE_AFTER_MS = 3 * 60 * 1000;

const coerce = (raw: unknown): GenerationState => {
  if (typeof raw !== 'object' || raw === null) return IDLE_STATE;
  const state = raw as GenerationState;
  if (
    state.status === 'running' &&
    (state.startedAt === null || Date.now() - state.startedAt > STALE_AFTER_MS)
  ) {
    return { ...state, status: 'error', error: { kind: 'timeout', message: 'Генерация прервалась. Попробуйте ещё раз.' } };
  }
  return state;
};

export const getGenerationState = async (): Promise<GenerationState> => {
  const stored = await chrome.storage.local.get(GENERATION_KEY);
  return coerce(stored[GENERATION_KEY]);
};

export const setGenerationState = async (state: GenerationState): Promise<void> => {
  await chrome.storage.local.set({ [GENERATION_KEY]: state });
};

export const onGenerationChanged = (
  listener: (state: GenerationState) => void,
): (() => void) => {
  const handler = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ): void => {
    if (areaName !== 'local' || !(GENERATION_KEY in changes)) return;
    listener(coerce(changes[GENERATION_KEY]?.newValue));
  };

  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
};

/** Text handed over by the context menu, consumed once by whichever UI opens. */
export const setPendingVacancy = async (text: string): Promise<void> => {
  await chrome.storage.local.set({ [PENDING_KEY]: text });
};

export const takePendingVacancy = async (): Promise<string | null> => {
  const stored = await chrome.storage.local.get(PENDING_KEY);
  const text = stored[PENDING_KEY];
  if (typeof text !== 'string' || !text.trim()) return null;
  await chrome.storage.local.remove(PENDING_KEY);
  return text;
};
