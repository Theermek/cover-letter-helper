/** Options page (TASK §4, §5, §9). */

import { StrictMode, useCallback, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { STRINGS } from '../config/strings';
import {
  LANGUAGE_LABELS,
  LENGTH_PRESETS,
  LETTER_LANGUAGES,
  LETTER_LENGTHS,
} from '../config/lengths';
import {
  deleteBrowserData,
  downloadExport,
  importFromFile,
  migrateLocalDataToServer,
} from '../lib/exportImport';
import { countVacancies } from '../storage/db';
import { saveSettings } from '../storage/settings';
import { isAppErrorShape } from '../lib/errors';
import { useFlash, useProfile, useSettings } from '../ui/hooks';
import { ServerForm } from '../ui/components/ServerForm';
import { ProviderForm } from '../ui/components/ProviderForm';
import { CvEditor } from '../ui/components/CvEditor';
import { ContactsEditor } from '../ui/components/ContactsEditor';
import { Segmented } from '../ui/components/Segmented';
import '../ui/styles.css';

const LANGUAGE_OPTIONS = LETTER_LANGUAGES.map((value) => ({
  value,
  label: LANGUAGE_LABELS[value],
}));

const LENGTH_OPTIONS = LETTER_LENGTHS.map((value) => ({
  value,
  label: LENGTH_PRESETS[value].label,
}));

const Options = () => {
  const { settings, loaded, reload } = useSettings();
  const { profile, loaded: profileLoaded, error: profileError, save: saveProfile } = useProfile();
  const [cvText, setCvText] = useState<string | null>(null);
  const [notice, flashNotice] = useFlash(4000);
  const [error, setError] = useState<string | null>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const [migrating, setMigrating] = useState(false);

  const handleImport = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setError(null);
      try {
        const { imported, skipped } = await importFromFile(file);
        flashNotice(STRINGS.options.importResult(imported, skipped));
      } catch (caught) {
        // A rejected request has a message worth showing; a malformed file does
        // not, so the generic "this is not an export file" stays for that case.
        setError(isAppErrorShape(caught) ? caught.message : STRINGS.options.importError);
      } finally {
        if (importInput.current) importInput.current.value = '';
      }
    },
    [flashNotice],
  );

  /**
   * The one-time transfer of data left in the browser from before the server.
   * Safe to press twice: the server deduplicates by text hash and never
   * overwrites a profile field that already has a value.
   */
  const handleMigrate = useCallback(async () => {
    setError(null);
    setMigrating(true);
    try {
      if ((await countVacancies()) === 0) {
        flashNotice(STRINGS.options.migrateEmpty);
        return;
      }
      const { imported, skipped } = await migrateLocalDataToServer();
      flashNotice(STRINGS.options.migrateDone(imported, skipped));
    } catch (caught) {
      setError(isAppErrorShape(caught) ? caught.message : STRINGS.server.failed);
    } finally {
      setMigrating(false);
    }
  }, [flashNotice]);

  const handleDeleteAll = useCallback(async () => {
    if (!confirm(STRINGS.options.confirmDeleteAll)) return;
    await deleteBrowserData();
    setCvText(null);
    reload();
    flashNotice(STRINGS.options.deletedAll);
  }, [reload, flashNotice]);

  if (!loaded) return <p className="hint">{STRINGS.common.loading}</p>;

  return (
    <main className="page stack">
      <div>
        <h1>{STRINGS.options.title}</h1>
        <p className="hint">{STRINGS.appName}</p>
      </div>

      <section className="card">
        <h2>{STRINGS.options.providerSection}</h2>
        <ProviderForm settings={settings} />
      </section>

      <section className="card">
        <h2>{STRINGS.server.section}</h2>
        <ServerForm settings={settings} />
      </section>

      <section className="card">
        <h2>{STRINGS.cv.title}</h2>
        {profileError && <p className="error">{profileError}</p>}
        {!profileLoaded && <p className="hint">{STRINGS.common.loading}</p>}
        {profile && (
          <CvEditor
            value={cvText ?? profile.cvText}
            onChange={setCvText}
            onSave={(text) => saveProfile({ cvText: text })}
          />
        )}
      </section>

      <section className="card">
        <h2>{STRINGS.contacts.section}</h2>
        <ContactsEditor />
      </section>

      <section className="card stack-sm">
        <h2>{STRINGS.signature.section}</h2>
        {profile && (
          <>
            <label className="check">
              <input
                type="checkbox"
                checked={profile.signature.enabled}
                onChange={(e) =>
                  void saveProfile({
                    signature: { ...profile.signature, enabled: e.target.checked },
                  })
                }
              />
              {STRINGS.signature.checkbox}
            </label>
            <label htmlFor="signature-ru">{STRINGS.signature.ruLabel}</label>
            <textarea
              id="signature-ru"
              rows={2}
              value={profile.signature.ru}
              onChange={(e) =>
                void saveProfile({ signature: { ...profile.signature, ru: e.target.value } })
              }
            />
            <label htmlFor="signature-en">{STRINGS.signature.enLabel}</label>
            <textarea
              id="signature-en"
              rows={2}
              value={profile.signature.en}
              onChange={(e) =>
                void saveProfile({ signature: { ...profile.signature, en: e.target.value } })
              }
            />
          </>
        )}
        <p className="hint">{STRINGS.signature.checkboxHint}</p>
      </section>

      <section className="card stack">
        <h2>{STRINGS.options.defaultsSection}</h2>
        <div className="controls">
          <div className="stack-sm">
            <span className="label">{STRINGS.generation.languageLabel}</span>
            <Segmented
              options={LANGUAGE_OPTIONS}
              value={settings.defaults.language}
              ariaLabel={STRINGS.generation.languageLabel}
              onChange={(language) =>
                void saveSettings({ defaults: { ...settings.defaults, language } })
              }
            />
          </div>
          <div className="stack-sm">
            <span className="label">{STRINGS.generation.lengthLabel}</span>
            <Segmented
              options={LENGTH_OPTIONS}
              value={settings.defaults.length}
              ariaLabel={STRINGS.generation.lengthLabel}
              onChange={(length) =>
                void saveSettings({ defaults: { ...settings.defaults, length } })
              }
            />
          </div>
        </div>
      </section>

      <section className="card stack">
        <h2>{STRINGS.options.dataSection}</h2>
        <div className="row">
          <button
            type="button"
            className="primary"
            disabled={migrating}
            onClick={() => void handleMigrate()}
          >
            {migrating ? STRINGS.options.migrating : STRINGS.options.migrate}
          </button>
        </div>
        <p className="hint">{STRINGS.options.migrateHint}</p>
        <div className="row">
          <button type="button" onClick={() => void downloadExport()}>
            {STRINGS.options.export}
          </button>
          <button type="button" onClick={() => importInput.current?.click()}>
            {STRINGS.options.import}
          </button>
          <input
            ref={importInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => void handleImport(e.target.files?.[0])}
          />
          <span className="spacer" />
          <button type="button" className="danger" onClick={() => void handleDeleteAll()}>
            {STRINGS.options.deleteAll}
          </button>
        </div>
        <p className="hint">{STRINGS.options.exportNote}</p>
        <p className="hint">{STRINGS.options.deleteAllHint}</p>
        {notice && <p className="success">{notice}</p>}
        {error && <p className="error">{error}</p>}
        <div className="row">
          <a href="stats.html" target="_blank" rel="noreferrer">
            {STRINGS.common.stats}
          </a>
        </div>
      </section>

      <section className="card">
        <h2>{STRINGS.options.privacyTitle}</h2>
        <p className="hint">{STRINGS.options.privacyBody}</p>
      </section>
    </main>
  );
};

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');

createRoot(root).render(
  <StrictMode>
    <Options />
  </StrictMode>,
);
