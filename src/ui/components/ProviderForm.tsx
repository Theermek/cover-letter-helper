/**
 * Provider, API key and model picker (TASK §4.1, §4.2).
 *
 * Shared by the onboarding flow and the options page so the two can never drift
 * apart. The model list comes from config, but the user can also refresh it
 * from the provider's own API or type a model id by hand -- a new model should
 * not require a new release.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { STRINGS } from '../../config/strings';
import { PROVIDERS, PROVIDER_IDS, type ProviderId } from '../../config/providers';
import { isAppErrorShape } from '../../lib/errors';
import { sendMessage } from '../../background/messages';
import {
  modelsFor,
  saveSettings,
  setApiKey,
  setFetchedModels,
  setModel,
  type Settings,
} from '../../storage/settings';

const CUSTOM = '__custom__';

interface Props {
  settings: Settings;
  /** Called after the key has been verified and everything is stored. */
  onSaved?: () => void;
}

export const ProviderForm = ({ settings, onSaved }: Props) => {
  const [provider, setProvider] = useState<ProviderId>(settings.provider ?? 'openai');
  const [apiKey, setKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [model, setModelId] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [checking, setChecking] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const config = PROVIDERS[provider];
  const models = modelsFor(settings, provider);

  // Re-seed the fields when the selected provider changes, so each provider
  // keeps its own key and model. Deliberately NOT re-run on every settings
  // change: an autosave elsewhere on the page (the CV editor, for one) must not
  // wipe a key the user is halfway through typing.
  const latestSettings = useRef(settings);
  latestSettings.current = settings;

  useEffect(() => {
    const current = latestSettings.current;
    setKey(current.apiKeys[provider] ?? '');
    const stored = current.models[provider] ?? '';
    const known = modelsFor(current, provider).some((m) => m.id === stored);
    setModelId(stored === '' || known ? stored : CUSTOM);
    setCustomModel(known ? '' : stored);
    setError(null);
    setNotice(null);
  }, [provider]);

  const effectiveModel = (model === CUSTOM ? customModel : model).trim() || config.defaultModel;

  const refreshModels = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    setNotice(null);
    try {
      const fetched = await sendMessage({ type: 'listModels', provider, apiKey: apiKey.trim() });
      await setFetchedModels(provider, fetched);
      setNotice(STRINGS.onboarding.modelsRefreshed(fetched.length));
    } catch (err) {
      setError(isAppErrorShape(err) ? err.message : STRINGS.common.loading);
    } finally {
      setRefreshing(false);
    }
  }, [provider, apiKey]);

  const checkAndSave = useCallback(async () => {
    setChecking(true);
    setError(null);
    setNotice(null);
    try {
      const key = apiKey.trim();
      await sendMessage({ type: 'validateKey', provider, apiKey: key, model: effectiveModel });

      // Only persist once the provider has actually accepted the key.
      await setApiKey(provider, key);
      await setModel(provider, effectiveModel);
      await saveSettings({ provider });

      setNotice(STRINGS.onboarding.keyValid);
      onSaved?.();
    } catch (err) {
      setError(isAppErrorShape(err) ? err.message : STRINGS.common.loading);
    } finally {
      setChecking(false);
    }
  }, [provider, apiKey, effectiveModel, onSaved]);

  return (
    <div className="stack">
      <div className="stack-sm">
        <label htmlFor="provider">{STRINGS.onboarding.providerLabel}</label>
        <select
          id="provider"
          value={provider}
          onChange={(e) => setProvider(e.target.value as ProviderId)}
        >
          {PROVIDER_IDS.map((id) => (
            <option key={id} value={id}>
              {PROVIDERS[id].label}
            </option>
          ))}
        </select>
      </div>

      <div className="stack-sm">
        <label htmlFor="api-key">{STRINGS.onboarding.apiKeyLabel}</label>
        <div className="row">
          <input
            id="api-key"
            type={showKey ? 'text' : 'password'}
            autoComplete="off"
            spellCheck={false}
            placeholder={config.keyPrefix ? `${config.keyPrefix}...` : ''}
            value={apiKey}
            onChange={(e) => setKey(e.target.value)}
          />
          <button type="button" className="icon" onClick={() => setShowKey((v) => !v)}>
            {showKey ? STRINGS.common.hide : STRINGS.common.show}
          </button>
        </div>
        <p className="hint">
          {config.keyHint}{' '}
          <a href={config.keysUrl} target="_blank" rel="noreferrer">
            {STRINGS.onboarding.getKey}
          </a>
        </p>
      </div>

      <div className="stack-sm">
        <label htmlFor="model">{STRINGS.onboarding.modelLabel}</label>
        <select id="model" value={model} onChange={(e) => setModelId(e.target.value)}>
          <option value="">
            По умолчанию ({config.defaultModel})
          </option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
          <option value={CUSTOM}>{STRINGS.onboarding.customModel}</option>
        </select>

        {model === CUSTOM && (
          <input
            type="text"
            placeholder={STRINGS.onboarding.customModelPlaceholder}
            value={customModel}
            spellCheck={false}
            onChange={(e) => setCustomModel(e.target.value)}
          />
        )}

        <div className="row">
          <button
            type="button"
            className="ghost icon"
            disabled={refreshing || !apiKey.trim()}
            onClick={() => void refreshModels()}
          >
            {refreshing ? STRINGS.onboarding.refreshingModels : STRINGS.onboarding.refreshModels}
          </button>
        </div>
      </div>

      <div className="row">
        <button
          type="button"
          className="primary"
          disabled={checking || !apiKey.trim()}
          onClick={() => void checkAndSave()}
        >
          {checking ? STRINGS.onboarding.checking : STRINGS.onboarding.checkAndSave}
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      {notice && <p className="success">{notice}</p>}
      <p className="hint">{STRINGS.onboarding.privacyNote}</p>
    </div>
  );
};
