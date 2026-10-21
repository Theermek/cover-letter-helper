/**
 * The provider abstraction (TASK §4.3).
 *
 * Every provider turns the same request into its own structured-output call and
 * returns an already-parsed response, so the rest of the app never branches on
 * which provider is active. Errors are normalised to AppError by each adapter.
 */

import type { ModelOption, ProviderId } from '../config/providers';
import type { ParsedResponse } from '../schema/response';

export interface GenerateParams {
  system: string;
  user: string;
  model: string;
  apiKey: string;
}

export interface LLMProvider {
  readonly id: ProviderId;
  /** Resolves on success; throws AppError with a user-readable message. */
  validateKey(apiKey: string, model: string): Promise<void>;
  generate(params: GenerateParams): Promise<ParsedResponse>;
  /** Live model list from the provider, for the "refresh" button in settings. */
  listModels(apiKey: string): Promise<ModelOption[]>;
}

/** Shared retry wrapper: one cheap second attempt on a malformed response. */
export const withOneRetry = async <T>(
  attempt: (isRetry: boolean) => Promise<T>,
  shouldRetry: (error: unknown) => boolean,
): Promise<T> => {
  try {
    return await attempt(false);
  } catch (error) {
    if (!shouldRetry(error)) throw error;
    return attempt(true);
  }
};
