/**
 * The generation screen (TASK §6.1), shared by the popup and the full-size
 * editor page. A popup is capped at roughly 800x600, which is cramped once the
 * vacancy, the controls and the letter are all on screen, so the same component
 * renders in a roomier layout on editor.html.
 */

import { useCallback, useEffect, useState } from 'react';
import { STRINGS } from '../config/strings';
import {
  LANGUAGE_LABELS,
  LENGTH_PRESETS,
  LETTER_LANGUAGES,
  LETTER_LENGTHS,
  type LetterLanguage,
  type LetterLength,
} from '../config/lengths';
import { isAppErrorShape } from '../lib/errors';
import { countWords } from '../lib/sanitizer';
import { sendMessage } from '../background/messages';
import { activeConfig, hasServer, saveSettings } from '../storage/settings';
import { takePendingVacancy } from '../storage/generation';
import { useFlash, useGenerationState, useProfile, useSettings } from './hooks';
import { Segmented } from './components/Segmented';
import { ContactsBlock } from './components/ContactsBlock';

const LANGUAGE_OPTIONS = LETTER_LANGUAGES.map((value) => ({
  value,
  label: LANGUAGE_LABELS[value],
}));

const LENGTH_OPTIONS = LETTER_LENGTHS.map((value) => ({
  value,
  label: LENGTH_PRESETS[value].label,
}));

const openOptions = (): void => {
  void chrome.runtime.openOptionsPage();
};
const openStats = (): void => {
  void chrome.tabs.create({ url: chrome.runtime.getURL('stats.html') });
};

interface Props {
  /** The popup gets a compact layout and an "open in a window" button. */
  variant: 'popup' | 'editor';
}

export const GenerationView = ({ variant }: Props) => {
  const { settings, loaded: settingsLoaded } = useSettings();
  const { profile, loaded: profileLoaded, error: profileError, save: saveProfile } = useProfile();
  const { state, loaded: stateLoaded } = useGenerationState();
  const [copied, flashCopied] = useFlash(1500);

  const [vacancyText, setVacancyText] = useState('');
  const [userPrompt, setUserPrompt] = useState('');
  const [language, setLanguage] = useState<LetterLanguage>('auto');
  const [length, setLength] = useState<LetterLength>('medium');
  const [letter, setLetter] = useState('');
  const [withSignature, setWithSignature] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Restore the last defaults once settings arrive.
  const [defaultsApplied, setDefaultsApplied] = useState(false);
  useEffect(() => {
    if (!settingsLoaded || defaultsApplied) return;
    setLanguage(settings.defaults.language);
    setLength(settings.defaults.length);
    setDefaultsApplied(true);
  }, [settingsLoaded, defaultsApplied, settings.defaults]);

  // The checkbox follows the profile until the user touches it.
  const [signatureApplied, setSignatureApplied] = useState(false);
  useEffect(() => {
    if (!profile || signatureApplied) return;
    setWithSignature(profile.signature.enabled);
    setSignatureApplied(true);
  }, [profile, signatureApplied]);

  // Restore whatever the service worker is holding: a request that outlived a
  // closed popup, or a finished letter the user has not seen yet.
  const [stateApplied, setStateApplied] = useState(false);
  useEffect(() => {
    if (!stateLoaded || stateApplied) return;
    if (state.input) {
      setVacancyText(state.input.vacancyText);
      setUserPrompt(state.input.userPrompt);
      setLanguage(state.input.language);
      setLength(state.input.length);
      setWithSignature(state.input.withSignature);
    }
    setStateApplied(true);
  }, [stateLoaded, stateApplied, state.input]);

  // Text picked up from the context menu wins over the restored input.
  useEffect(() => {
    void takePendingVacancy().then((pending) => {
      if (pending) setVacancyText(pending);
    });
  }, []);

  // Follow the worker's result, including edits made in the other window.
  useEffect(() => {
    if (state.status === 'done' && state.result) setLetter(state.result.letter);
    if (state.status === 'idle') setLetter('');
  }, [state.status, state.result]);

  const isRunning = state.status === 'running';
  const serverReady = hasServer(settings);
  const ready = serverReady && activeConfig(settings) !== null;
  const hasCv = (profile?.cvText ?? '').trim().length > 0;
  const requirements = state.result?.companyRequirements;
  const onlyPhrase = requirements?.mode === 'only_phrase';

  const persistDefaults = useCallback(
    (next: { language?: LetterLanguage; length?: LetterLength }) => {
      void saveSettings({
        defaults: {
          language: next.language ?? language,
          length: next.length ?? length,
        },
      });
    },
    [language, length],
  );

  const toggleSignature = useCallback(
    (next: boolean) => {
      setWithSignature(next);
      if (profile) void saveProfile({ signature: { ...profile.signature, enabled: next } });
    },
    [profile, saveProfile],
  );

  const generate = useCallback(async () => {
    const text = vacancyText.trim();
    if (!text) {
      setFormError(STRINGS.generation.emptyVacancy);
      return;
    }
    setFormError(null);

    try {
      await sendMessage({
        type: 'generate',
        input: { vacancyText: text, language, length, userPrompt, withSignature },
      });
    } catch (error) {
      setFormError(isAppErrorShape(error) ? error.message : STRINGS.common.loading);
    }
  }, [vacancyText, language, length, userPrompt, withSignature]);

  const regenerate = useCallback(async () => {
    await sendMessage({ type: 'resetGeneration' });
    await generate();
  }, [generate]);

  const copy = useCallback(() => {
    // A rejected clipboard write is silent otherwise: the icon would simply
    // never turn into a tick and the user would not know why.
    void navigator.clipboard
      .writeText(letter)
      .then(() => {
        setFormError(null);
        flashCopied(STRINGS.generation.copied);
      })
      .catch(() => setFormError(STRINGS.generation.copyError));
  }, [letter, flashCopied]);

  const persistLetter = useCallback(() => {
    if (state.status !== 'done' || letter === state.result?.letter) return;
    void sendMessage({ type: 'updateLetter', letter });
  }, [letter, state.status, state.result]);

  const openEditor = useCallback(() => {
    void chrome.tabs.create({ url: chrome.runtime.getURL('editor.html') });
  }, []);

  if (!settingsLoaded) return <p className="hint">{STRINGS.common.loading}</p>;

  return (
    <div className={`stack generation generation-${variant}`}>
      {!serverReady && (
        <div className="notice">
          <strong>{STRINGS.server.needed}</strong>
          {STRINGS.server.neededHint}{' '}
          <button type="button" className="ghost" onClick={openOptions}>
            Открыть настройки
          </button>
        </div>
      )}

      {serverReady && profileError && <p className="error">{profileError}</p>}

      {serverReady && !ready && (
        <div className="notice">
          <strong>Нужна настройка</strong>
          Выберите провайдера и введите API-ключ.{' '}
          <button type="button" className="ghost" onClick={openOptions}>
            Открыть настройки
          </button>
        </div>
      )}

      {ready && profileLoaded && !profileError && !hasCv && (
        <div className="notice">
          <strong>{STRINGS.cv.empty}</strong>
          {STRINGS.cv.emptyHint}{' '}
          <button type="button" className="ghost" onClick={openOptions}>
            Добавить CV
          </button>
        </div>
      )}

      <div className="stack-sm">
        <div className="row-between">
          <label htmlFor="vacancy">{STRINGS.generation.vacancyLabel}</label>
          {variant === 'popup' && (
            <button
              type="button"
              className="ghost icon-btn"
              title={STRINGS.generation.expand}
              aria-label={STRINGS.generation.expand}
              onClick={openEditor}
            >
              ⤢
            </button>
          )}
        </div>
        <textarea
          id="vacancy"
          rows={variant === 'popup' ? 5 : 12}
          placeholder={STRINGS.generation.vacancyPlaceholder}
          value={vacancyText}
          onChange={(e) => setVacancyText(e.target.value)}
        />
      </div>

      <div className="controls">
        <div className="stack-sm">
          <span className="label">{STRINGS.generation.languageLabel}</span>
          <Segmented
            options={LANGUAGE_OPTIONS}
            value={language}
            ariaLabel={STRINGS.generation.languageLabel}
            onChange={(next) => {
              setLanguage(next);
              persistDefaults({ language: next });
            }}
          />
        </div>
        <div className="stack-sm">
          <span className="label">{STRINGS.generation.lengthLabel}</span>
          <Segmented
            options={LENGTH_OPTIONS}
            value={length}
            ariaLabel={STRINGS.generation.lengthLabel}
            onChange={(next) => {
              setLength(next);
              persistDefaults({ length: next });
            }}
          />
        </div>
      </div>

      <div className="stack-sm">
        <label htmlFor="user-prompt">{STRINGS.generation.userPromptLabel}</label>
        <textarea
          id="user-prompt"
          rows={2}
          placeholder={STRINGS.generation.userPromptPlaceholder}
          value={userPrompt}
          onChange={(e) => setUserPrompt(e.target.value)}
        />
      </div>

      <div className="row">
        <button
          type="button"
          className="primary"
          disabled={isRunning || !ready || !hasCv}
          onClick={() => void generate()}
        >
          {isRunning ? (
            <span className="row">
              <span className="spinner" /> {STRINGS.generation.generating}
            </span>
          ) : (
            STRINGS.generation.generate
          )}
        </button>
        <label className="check" title={STRINGS.signature.checkboxHint}>
          <input
            type="checkbox"
            checked={withSignature}
            onChange={(e) => toggleSignature(e.target.checked)}
          />
          {STRINGS.signature.checkbox}
        </label>
        <span className="spacer" />
        <button
          type="button"
          className="ghost icon-btn"
          title={STRINGS.common.stats}
          aria-label={STRINGS.common.stats}
          onClick={openStats}
        >
          ▤
        </button>
        <button
          type="button"
          className="ghost icon-btn"
          title={STRINGS.common.settings}
          aria-label={STRINGS.common.settings}
          onClick={openOptions}
        >
          ⚙
        </button>
      </div>

      {/* Collapsed by default in the popup so it costs one line, not a screen. */}
      <ContactsBlock defaultOpen={variant === 'editor'} />

      {formError && <p className="error">{formError}</p>}
      {state.status === 'error' && state.error && <p className="error">{state.error.message}</p>}

      {requirements?.found && requirements.description && (
        <div className="notice">
          <strong>⚠ {STRINGS.generation.companyRequirements}</strong>
          {requirements.description}
          {onlyPhrase && <p className="hint">{STRINGS.generation.onlyPhraseNote}</p>}
        </div>
      )}

      {state.status === 'done' && state.result && (
        <div className="stack-sm">
          {/* Both actions live in the label row: below the textarea they were
              past the popup's scroll edge and effectively invisible. */}
          <div className="row-between">
            <label htmlFor="letter">{STRINGS.generation.resultLabel}</label>
            <div className="row">
              <span className="hint">{STRINGS.cv.wordCount(countWords(letter))}</span>
              <button
                type="button"
                className="ghost icon-btn"
                title={STRINGS.generation.copy}
                aria-label={STRINGS.generation.copy}
                onClick={copy}
              >
                {copied === null ? '⧉' : '✓'}
              </button>
              <button
                type="button"
                className="ghost icon-btn"
                disabled={isRunning}
                title={STRINGS.generation.regenerate}
                aria-label={STRINGS.generation.regenerate}
                onClick={() => void regenerate()}
              >
                ↻
              </button>
            </div>
          </div>
          <textarea
            id="letter"
            rows={variant === 'popup' ? 8 : 14}
            value={letter}
            onChange={(e) => setLetter(e.target.value)}
            onBlur={persistLetter}
          />
          <span className="hint">
            {state.result.vacancyId === null
              ? STRINGS.generation.notSaved
              : state.result.createdNew
                ? STRINGS.generation.savedNew
                : STRINGS.generation.savedUpdated}
          </span>
        </div>
      )}
    </div>
  );
};
