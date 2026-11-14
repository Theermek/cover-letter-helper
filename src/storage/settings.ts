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
import { DEFAULT_SIGNATURES, type SignatureTemplates } from '../lib/signature';

/** Where the backend lives and how we authenticate to it (TASK2 §1.5). */
export interface ServerSettings {
  url: string;
  /** Static bearer token; the server holds the same string in its env. */
  token: string;
}

export interface Settings {
  server: ServerSettings;
  provider: ProviderId | null;
  /** Per-provider API key. Never exported, never logged. */
  apiKeys: Partial<Record<ProviderId, string>>;
  /** Per-provider chosen model; empty means "use the provider default". */
  models: Partial<Record<ProviderId, string>>;
  /** Model lists refreshed from a provider's own /models endpoint. */
  fetchedModels: Partial<Record<ProviderId, ModelOption[]>>;
  cvText: string;
  /** Appended by code after generation, never written by the model. */
  signature: SignatureTemplates;
  defaults: {
    language: LetterLanguage;
    length: LetterLength;
  };
}

const SETTINGS_KEY = 'settings';

export const DEFAULT_SETTINGS: Settings = {
  // The default assumes the server runs on the same machine, which is how it
  // is meant to be used until a deployment target is chosen.
  server: { url: 'http://localhost:3000', token: '' },
  provider: null,
  apiKeys: {},
  models: {},
  fetchedModels: {},
  cvText: '',
  signature: DEFAULT_SIGNATURES,
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

  const pickSignature = (input: unknown): SignatureTemplates => {
    const source = (typeof input === 'object' && input !== null ? input : {}) as Partial<
      SignatureTemplates
    >;
    return {
      enabled: source.enabled === true,
      ru: typeof source.ru === 'string' ? source.ru : DEFAULT_SIGNATURES.ru,
      en: typeof source.en === 'string' ? source.en : DEFAULT_SIGNATURES.en,
    };
  };

  const pickServer = (input: unknown): ServerSettings => {
    const source = (typeof input === 'object' && input !== null ? input : {}) as Partial<
      ServerSettings
    >;
    return {
      url: typeof source.url === 'string' ? source.url : DEFAULT_SETTINGS.server.url,
      token: typeof source.token === 'string' ? source.token : '',
    };
  };

  return {
    server: pickServer(value.server),
    provider: isProviderId(value.provider) ? value.provider : null,
    apiKeys: pickStrings(value.apiKeys),
    models: pickStrings(value.models),
    fetchedModels: pickModels(value.fetchedModels),
    cvText: typeof value.cvText === 'string' ? value.cvText : '',
    signature: pickSignature(value.signature),
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

/** True when the extension knows where the server is and how to authenticate. */
export const hasServer = (settings: Settings): boolean =>
  settings.server.url.trim() !== '' && settings.server.token.trim() !== '';

export const setServer = async (patch: Partial<ServerSettings>): Promise<Settings> => {
  const current = await getSettings();
  return saveSettings({ server: { ...current.server, ...patch } });
};

/** Everything the export file may contain -- API keys are structurally absent. */
export const exportableSettings = (settings: Settings) => ({
  provider: settings.provider,
  model: settings.provider ? (settings.models[settings.provider] ?? null) : null,
  cvText: settings.cvText,
  signature: settings.signature,
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
