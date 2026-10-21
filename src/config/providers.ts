/**
 * Single source of truth for providers, their models and API shape.
 * Updating the model list for a new release means editing only this file --
 * users can additionally type a custom model id or refresh the list from the
 * provider's own /models endpoint (see src/providers/*.ts).
 */

export const PROVIDER_IDS = ['openai', 'anthropic', 'gemini'] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export interface ModelOption {
  readonly id: string;
  readonly label: string;
}

export interface ProviderConfig {
  readonly id: ProviderId;
  readonly label: string;
  /** Human hint shown under the API key field. */
  readonly keyHint: string;
  readonly keysUrl: string;
  /** Loose sanity check only -- never used to reject a key outright. */
  readonly keyPrefix: string | null;
  readonly models: readonly ModelOption[];
  readonly defaultModel: string;
  /**
   * Current Anthropic models reject `temperature` (sampling params were removed
   * on the 4.6+ family), so the request builder omits it there.
   */
  readonly supportsTemperature: boolean;
  readonly temperature: number;
  readonly maxOutputTokens: number;
}

export const PROVIDERS: Readonly<Record<ProviderId, ProviderConfig>> = {
  openai: {
    id: 'openai',
    label: 'OpenAI',
    keyHint: 'Ключ начинается с sk-. Создаётся в личном кабинете OpenAI.',
    keysUrl: 'https://platform.openai.com/api-keys',
    keyPrefix: 'sk-',
    models: [
      { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini (дёшево, по умолчанию)' },
      { id: 'gpt-4.1', label: 'GPT-4.1' },
      { id: 'gpt-4o', label: 'GPT-4o' },
      { id: 'gpt-4o-mini', label: 'GPT-4o mini' },
      { id: 'gpt-5', label: 'GPT-5' },
      { id: 'gpt-5-mini', label: 'GPT-5 mini' },
    ],
    defaultModel: 'gpt-4.1-mini',
    supportsTemperature: true,
    temperature: 0.8,
    maxOutputTokens: 4096,
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    keyHint: 'Ключ начинается с sk-ant-. Создаётся в Anthropic Console.',
    keysUrl: 'https://console.anthropic.com/settings/keys',
    keyPrefix: 'sk-ant-',
    models: [
      { id: 'claude-opus-5', label: 'Claude Opus 5 (по умолчанию)' },
      { id: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
      { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 (дёшево)' },
    ],
    defaultModel: 'claude-opus-5',
    supportsTemperature: false,
    temperature: 1,
    maxOutputTokens: 8000,
  },
  gemini: {
    id: 'gemini',
    label: 'Google Gemini',
    keyHint: 'Ключ создаётся в Google AI Studio.',
    keysUrl: 'https://aistudio.google.com/apikey',
    keyPrefix: null,
    models: [
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (по умолчанию)' },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    ],
    defaultModel: 'gemini-2.5-flash',
    supportsTemperature: true,
    temperature: 0.8,
    maxOutputTokens: 4096,
  },
};

export const isProviderId = (value: unknown): value is ProviderId =>
  typeof value === 'string' && (PROVIDER_IDS as readonly string[]).includes(value);

/** Falls back to the provider default when the stored model is empty. */
export const resolveModel = (provider: ProviderId, model: string | undefined): string => {
  const trimmed = model?.trim();
  return trimmed ? trimmed : PROVIDERS[provider].defaultModel;
};
