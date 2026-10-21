/** Message contract between the UI pages and the service worker. */

import type { ModelOption, ProviderId } from '../config/providers';
import type { AppErrorShape } from '../lib/errors';
import type { GenerationInput, GenerationState } from '../storage/generation';

export type Request =
  | { type: 'generate'; input: GenerationInput }
  | { type: 'getGenerationState' }
  | { type: 'resetGeneration' }
  | { type: 'updateLetter'; letter: string }
  | { type: 'validateKey'; provider: ProviderId; apiKey: string; model: string }
  | { type: 'listModels'; provider: ProviderId; apiKey: string };

export type Response<T> = { ok: true; data: T } | { ok: false; error: AppErrorShape };

export interface ResponseMap {
  generate: GenerationState;
  getGenerationState: GenerationState;
  resetGeneration: GenerationState;
  updateLetter: null;
  validateKey: null;
  listModels: ModelOption[];
}

/**
 * Typed wrapper over chrome.runtime.sendMessage. Rejects with an AppErrorShape
 * so callers always have a user-readable message, never a raw API payload.
 */
export const sendMessage = async <K extends Request['type']>(
  request: Extract<Request, { type: K }>,
): Promise<ResponseMap[K]> => {
  const response = (await chrome.runtime.sendMessage(request)) as
    | Response<ResponseMap[K]>
    | undefined;

  if (!response) {
    throw {
      kind: 'unknown',
      message: 'Расширение не отвечает. Попробуйте перезагрузить его на странице chrome://extensions.',
    } satisfies AppErrorShape;
  }
  if (!response.ok) throw response.error;
  return response.data;
};
