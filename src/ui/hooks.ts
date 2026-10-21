/** Shared React hooks for the extension pages. */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_SETTINGS,
  getSettings,
  onSettingsChanged,
  type Settings,
} from '../storage/settings';
import {
  IDLE_STATE,
  getGenerationState,
  onGenerationChanged,
  type GenerationState,
} from '../storage/generation';

/** Settings plus a `loaded` flag, kept in sync across every open page. */
export const useSettings = (): { settings: Settings; loaded: boolean; reload: () => void } => {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(() => {
    void getSettings().then((next) => {
      setSettings(next);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    reload();
    return onSettingsChanged(setSettings);
  }, [reload]);

  return { settings, loaded, reload };
};

/**
 * The generation state owned by the service worker. Subscribing to storage
 * means a popup that was closed mid-request shows the finished result when it
 * is opened again.
 */
export const useGenerationState = (): { state: GenerationState; loaded: boolean } => {
  const [state, setState] = useState<GenerationState>(IDLE_STATE);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void getGenerationState().then((next) => {
      setState(next);
      setLoaded(true);
    });
    return onGenerationChanged(setState);
  }, []);

  return { state, loaded };
};

/** Shows a transient confirmation ("Скопировано") and clears it on its own. */
export const useFlash = (ms = 2000): [string | null, (message: string) => void] => {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = useCallback(
    (next: string) => {
      setMessage(next);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setMessage(null), ms);
    },
    [ms],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return [message, flash];
};
