/**
 * Settings, API keys and CV in chrome.storage.local (TASK §4.4).
 *
 * A key is stored per provider, so switching providers does not destroy the
 * previous key. Keys are never logged and never leave the extension except in
 * the request to that provider's own API; `exportableSettings()` below is what
 * the export feature uses, and it deliberately cannot see them.
 */

import { PROVIDERS, isProviderId, type ModelOption, type ProviderId } from '../config/providers';
import {
  isLetterLanguage,
  isLetterLength,
  type LetterLanguage,
  type LetterLength,
} from '../config/lengths';

export interface Settings {
  provider: ProviderId | null;
  /** Per-provider API key. Never exported, never logged. */
  apiKeys: Partial<Record<ProviderId, string>>;
  /** Per-provider chosen model; empty means "use the provider default". */
  models: Partial<Record<ProviderId, string>>;
  /** Model lists refreshed from a provider's own /models endpoint. */
  fetchedModels: Partial<Record<ProviderId, ModelOption[]>>;
  cvText: string;
  defaults: {
    language: LetterLanguage;
    length: LetterLength;
  };
}

const SETTINGS_KEY = 'settings';

export const DEFAULT_SETTINGS: Settings = {
  provider: null,
  apiKeys: {},
  models: {},
  fetchedModels: {},
  cvText: '',
  defaults: { language: 'auto', length: 'medium' },
};

/** Defensive read: storage may hold data written by an older version. */
const coerce = (raw: unknown): Settings => {
  const value = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<Settings>;
  const defaults = (value.defaults ?? {}) as Partial<Settings['defaults']>;

  const pickStrings = (input: unknown): Partial<Record<ProviderId, string>> => {
    const source = (typeof input === 'object' && input !== null ? input : {}) as Record<
      string,
      unknown
    >;
    const out: Partial<Record<ProviderId, string>> = {};
    for (const [key, val] of Object.entries(source)) {
      if (isProviderId(key) && typeof val === 'string') out[key] = val;
    }
    return out;
  };

  const pickModels = (input: unknown): Partial<Record<ProviderId, ModelOption[]>> => {
    const source = (typeof input === 'object' && input !== null ? input : {}) as Record<
      string,
      unknown
    >;
    const out: Partial<Record<ProviderId, ModelOption[]>> = {};
    for (const [key, val] of Object.entries(source)) {
      if (!isProviderId(key) || !Array.isArray(val)) continue;
      const models = val.filter(
        (m): m is ModelOption =>
          typeof m === 'object' &&
          m !== null &&
          typeof (m as ModelOption).id === 'string' &&
          typeof (m as ModelOption).label === 'string',
      );
      if (models.length > 0) out[key] = models;
    }
    return out;
  };

  return {
    provider: isProviderId(value.provider) ? value.provider : null,
    apiKeys: pickStrings(value.apiKeys),
    models: pickStrings(value.models),
    fetchedModels: pickModels(value.fetchedModels),
    cvText: typeof value.cvText === 'string' ? value.cvText : '',
    defaults: {
      language: isLetterLanguage(defaults.language) ? defaults.language : 'auto',
      length: isLetterLength(defaults.length) ? defaults.length : 'medium',
    },
  };
};

export const getSettings = async (): Promise<Settings> => {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  return coerce(stored[SETTINGS_KEY]);
};

export const saveSettings = async (patch: Partial<Settings>): Promise<Settings> => {
  const current = await getSettings();
  const next: Settings = { ...current, ...patch };
  await chrome.storage.local.set({ [SETTINGS_KEY]: next });
  return next;
};

export const setApiKey = async (provider: ProviderId, apiKey: string): Promise<Settings> => {
  const current = await getSettings();
  return saveSettings({ apiKeys: { ...current.apiKeys, [provider]: apiKey.trim() } });
};

export const setModel = async (provider: ProviderId, model: string): Promise<Settings> => {
  const current = await getSettings();
  return saveSettings({ models: { ...current.models, [provider]: model.trim() } });
};

export const setFetchedModels = async (
  provider: ProviderId,
  models: ModelOption[],
): Promise<Settings> => {
  const current = await getSettings();
  return saveSettings({ fetchedModels: { ...current.fetchedModels, [provider]: models } });
};

/** The models shown in the picker: refreshed list when present, else the config. */
export const modelsFor = (settings: Settings, provider: ProviderId): readonly ModelOption[] => {
  const fetched = settings.fetchedModels[provider];
  return fetched && fetched.length > 0 ? fetched : PROVIDERS[provider].models;
};

export interface ActiveConfig {
  provider: ProviderId;
  apiKey: string;
  model: string;
}

/** Returns null when onboarding is not finished (no provider or no key). */
export const activeConfig = (settings: Settings): ActiveConfig | null => {
  const provider = settings.provider;
  if (!provider) return null;

  const apiKey = settings.apiKeys[provider]?.trim();
  if (!apiKey) return null;

  const chosen = settings.models[provider]?.trim();
  return { provider, apiKey, model: chosen ? chosen : PROVIDERS[provider].defaultModel };
};

export const isOnboarded = (settings: Settings): boolean => activeConfig(settings) !== null;

/** Everything the export file may contain -- API keys are structurally absent. */
export const exportableSettings = (settings: Settings) => ({
  provider: settings.provider,
  model: settings.provider ? (settings.models[settings.provider] ?? null) : null,
  cvText: settings.cvText,
  defaultLanguage: settings.defaults.language,
  defaultLength: settings.defaults.length,
});

export const onSettingsChanged = (listener: (settings: Settings) => void): (() => void) => {
  const handler = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ): void => {
    if (areaName !== 'local' || !(SETTINGS_KEY in changes)) return;
    listener(coerce(changes[SETTINGS_KEY]?.newValue));
  };

  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
};
