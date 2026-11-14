/**
 * First-run flow shown in place of the main popup UI (TASK §4.1):
 * provider and key first, then the CV.
 */

import { useState } from 'react';
import { STRINGS } from '../config/strings';
import { saveSettings } from '../storage/settings';
import type { Settings } from '../storage/settings';
import { ProviderForm } from './components/ProviderForm';
import { CvEditor } from './components/CvEditor';

interface Props {
  settings: Settings;
  /** Called when the user finishes the last step. */
  onDone: () => void;
}

export const Onboarding = ({ settings, onDone }: Props) => {
  const [step, setStep] = useState<'provider' | 'cv'>('provider');
  const [cvText, setCvText] = useState(settings.cvText);

  return (
    <div className="stack">
      <div>
        <h1>{STRINGS.onboarding.title}</h1>
        <p className="hint">
          Шаг {step === 'provider' ? 1 : 2} из 2:{' '}
          {step === 'provider' ? STRINGS.onboarding.stepProvider : STRINGS.onboarding.stepCv}
        </p>
      </div>

      {step === 'provider' ? (
        <ProviderForm settings={settings} onSaved={() => setStep('cv')} />
      ) : (
        <div className="stack">
          <h2>{STRINGS.cv.title}</h2>
          <CvEditor value={cvText} onChange={setCvText} rows={8} />
          <div className="row">
            <button type="button" className="ghost" onClick={() => setStep('provider')}>
              {STRINGS.common.back}
            </button>
            <span className="spacer" />
            <button
              type="button"
              className="primary"
              disabled={!cvText.trim()}
              onClick={() => void saveSettings({ cvText }).then(onDone)}
            >
              {STRINGS.common.ready}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
