/**
 * Anthropic adapter.
 *
 * Two things differ from the other providers and are easy to get wrong:
 *  - structured output goes through `output_config.format`; forced tool use
 *    (tool_choice: "tool"/"any") is rejected by current models, so it must not
 *    be used to coax JSON out of them;
 *  - sampling parameters were removed on the current model family, so
 *    `temperature` is never sent (config.supportsTemperature is false).
 */

import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { PROVIDERS, type ModelOption } from '../config/providers';
import { appError, toAppError } from '../lib/errors';
import { ModelResponseSchema, parseModelResponse, type ParsedResponse } from '../schema/response';
import type { GenerateParams, LLMProvider } from './types';

const config = PROVIDERS.anthropic;

/**
 * `dangerouslyAllowBrowser` also sets the
 * `anthropic-dangerous-direct-browser-access` header required for direct calls
 * from a browser context (TASK §4.3). The key is the user's own and is sent
 * only to Anthropic.
 */
const client = (apiKey: string): Anthropic =>
  new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1 });

const textOf = (content: readonly { type: string }[]): string =>
  content
    .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
    .map((block) => block.text)
    .join('');

export const anthropicProvider: LLMProvider = {
  id: 'anthropic',

  async validateKey(apiKey: string, model: string): Promise<void> {
    try {
      await client(apiKey).messages.create({
        model,
        max_tokens: 4,
        messages: [{ role: 'user', content: 'ping' }],
      });
    } catch (error) {
      throw toAppError(error);
    }
  },

  async generate({ system, user, model, apiKey }: GenerateParams): Promise<ParsedResponse> {
    try {
      const message = await client(apiKey).messages.parse({
        model,
        max_tokens: config.maxOutputTokens,
        system,
        messages: [{ role: 'user', content: user }],
        output_config: {
          format: zodOutputFormat(ModelResponseSchema),
          // Letter writing is not an intelligence-sensitive task; low effort
          // keeps latency and cost down without hurting the result.
          effort: 'low',
        },
      });

      if (message.stop_reason === 'refusal') {
        throw appError('bad_response', 'model refused the request');
      }
      if (message.parsed_output) return parseModelResponse(message.parsed_output);

      const text = textOf(message.content);
      if (text.trim()) return parseModelResponse(text);

      throw appError('bad_response', 'empty message');
    } catch (error) {
      throw toAppError(error);
    }
  },

  async listModels(apiKey: string): Promise<ModelOption[]> {
    try {
      const page = await client(apiKey).models.list({ limit: 100 });
      return page.data.map((m) => ({ id: m.id, label: m.display_name || m.id }));
    } catch (error) {
      throw toAppError(error);
    }
  },
};
