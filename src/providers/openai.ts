/**
 * OpenAI adapter. Uses chat.completions.parse with a zod-derived strict JSON
 * schema, so the model is constrained to the shape rather than merely asked.
 */

import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { PROVIDERS, type ModelOption } from '../config/providers';
import { appError, toAppError } from '../lib/errors';
import { ModelResponseSchema, parseModelResponse, type ParsedResponse } from '../schema/response';
import type { GenerateParams, LLMProvider } from './types';

const config = PROVIDERS.openai;

/**
 * `dangerouslyAllowBrowser` is required because this runs inside the extension
 * service worker. The warning it guards against -- shipping a shared key to end
 * users -- does not apply: the key is the user's own and never leaves their
 * machine except in this request.
 */
const client = (apiKey: string): OpenAI =>
  new OpenAI({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1 });

const responseFormat = () => zodResponseFormat(ModelResponseSchema, 'cover_letter');

export const openaiProvider: LLMProvider = {
  id: 'openai',

  async validateKey(apiKey: string, model: string): Promise<void> {
    try {
      await client(apiKey).chat.completions.create({
        model,
        max_completion_tokens: 8,
        messages: [{ role: 'user', content: 'ping' }],
      });
    } catch (error) {
      throw toAppError(error);
    }
  },

  async generate({ system, user, model, apiKey }: GenerateParams): Promise<ParsedResponse> {
    try {
      const completion = await client(apiKey).chat.completions.parse({
        model,
        ...(config.supportsTemperature ? { temperature: config.temperature } : {}),
        max_completion_tokens: config.maxOutputTokens,
        response_format: responseFormat(),
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      });

      const message = completion.choices[0]?.message;
      if (message?.refusal) throw appError('bad_response', `refusal: ${message.refusal}`);

      // The SDK parses for us, but fall back to the raw string so a schema the
      // helper rejects can still be salvaged by the lenient parser.
      if (message?.parsed) return parseModelResponse(message.parsed);
      if (message?.content) return parseModelResponse(message.content);

      throw appError('bad_response', 'empty completion');
    } catch (error) {
      throw toAppError(error);
    }
  },

  async listModels(apiKey: string): Promise<ModelOption[]> {
    try {
      const page = await client(apiKey).models.list();
      return page.data
        .filter((m) => /^(gpt|o\d)/.test(m.id) && !/(audio|realtime|transcribe|tts|image)/.test(m.id))
        .map((m) => ({ id: m.id, label: m.id }))
        .sort((a, b) => a.id.localeCompare(b.id));
    } catch (error) {
      throw toAppError(error);
    }
  },
};
