import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { STRINGS } from '../config/strings';
import { GenerationView } from '../ui/GenerationView';
import { Onboarding } from '../ui/Onboarding';
import { useSettings } from '../ui/hooks';
import { isOnboarded } from '../storage/settings';
import '../ui/styles.css';

/**
 * Until a provider and key exist the popup shows onboarding instead of the
 * main screen (TASK §4.1).
 *
 * The decision is taken once, when settings first load, and then held: saving
 * the key in step 1 immediately satisfies `isOnboarded`, so recomputing it on
 * every settings change would skip the CV step the user has not seen yet.
 */
const Popup = () => {
  const { settings, loaded } = useSettings();
  const [onboarding, setOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    if (loaded && onboarding === null) setOnboarding(!isOnboarded(settings));
  }, [loaded, settings, onboarding]);

  if (!loaded || onboarding === null) return <p className="hint">{STRINGS.common.loading}</p>;

  return onboarding ? (
    <Onboarding settings={settings} onDone={() => setOnboarding(false)} />
  ) : (
    <GenerationView variant="popup" />
  );
};

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');

createRoot(root).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
);
