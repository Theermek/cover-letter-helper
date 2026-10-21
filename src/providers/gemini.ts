/**
 * Google Gemini adapter. Structured output is requested with a JSON mime type
 * plus a JSON Schema derived from the same zod schema the other providers use.
 */

import { GoogleGenAI } from '@google/genai';
import { PROVIDERS, type ModelOption } from '../config/providers';
import { appError, toAppError } from '../lib/errors';
import { parseModelResponse, responseJsonSchema, type ParsedResponse } from '../schema/response';
import type { GenerateParams, LLMProvider } from './types';

const config = PROVIDERS.gemini;

const client = (apiKey: string): GoogleGenAI => new GoogleGenAI({ apiKey });

/** Gemini returns ids as "models/gemini-2.5-flash"; the API accepts both. */
const shortId = (name: string): string => name.replace(/^models\//, '');

export const geminiProvider: LLMProvider = {
  id: 'gemini',

  async validateKey(apiKey: string, model: string): Promise<void> {
    try {
      await client(apiKey).models.generateContent({
        model,
        contents: 'ping',
        config: { maxOutputTokens: 8 },
      });
    } catch (error) {
      throw toAppError(error);
    }
  },

  async generate({ system, user, model, apiKey }: GenerateParams): Promise<ParsedResponse> {
    try {
      const result = await client(apiKey).models.generateContent({
        model,
        contents: user,
        config: {
          systemInstruction: system,
          temperature: config.temperature,
          maxOutputTokens: config.maxOutputTokens,
          responseMimeType: 'application/json',
          responseJsonSchema: responseJsonSchema(),
        },
      });

      const text = result.text;
      if (!text || !text.trim()) throw appError('bad_response', 'empty response');
      return parseModelResponse(text);
    } catch (error) {
      throw toAppError(error);
    }
  },

  async listModels(apiKey: string): Promise<ModelOption[]> {
    try {
      const page = await client(apiKey).models.list();
      const options: ModelOption[] = [];

      for await (const model of page) {
        const id = shortId(model.name ?? '');
        if (!id || !id.startsWith('gemini')) continue;
        // Only models that can answer a prompt are useful here.
        if (model.supportedActions && !model.supportedActions.includes('generateContent')) continue;
        options.push({ id, label: model.displayName || id });
      }

      return options.sort((a, b) => a.id.localeCompare(b.id));
    } catch (error) {
      throw toAppError(error);
    }
  },
};
