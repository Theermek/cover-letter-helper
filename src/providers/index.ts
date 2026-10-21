/** Registry mapping a provider id onto its implementation (TASK §4.3). */

import type { ProviderId } from '../config/providers';
import { anthropicProvider } from './anthropic';
import { geminiProvider } from './gemini';
import { openaiProvider } from './openai';
import type { LLMProvider } from './types';

const REGISTRY: Readonly<Record<ProviderId, LLMProvider>> = {
  openai: openaiProvider,
  anthropic: anthropicProvider,
  gemini: geminiProvider,
};

export const getProvider = (id: ProviderId): LLMProvider => REGISTRY[id];

export type { LLMProvider, GenerateParams } from './types';
