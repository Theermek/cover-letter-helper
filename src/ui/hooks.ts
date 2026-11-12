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
import { contactsStore } from '../storage/contacts';
import type { Contact } from '../storage/types';

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

/**
 * Contacts, kept in sync across open pages. The component only ever sees the
 * `ContactsStore` interface, so moving contacts to the server on stage 1 does
 * not touch this hook's callers.
 */
export const useContacts = (): {
  contacts: readonly Contact[];
  loaded: boolean;
  save: (next: readonly Contact[]) => Promise<void>;
} => {
  const [contacts, setContacts] = useState<readonly Contact[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void contactsStore.list().then((next) => {
      setContacts(next);
      setLoaded(true);
    });
    return contactsStore.subscribe(setContacts);
  }, []);

  const save = useCallback(async (next: readonly Contact[]) => {
    // Optimistic: the editor stays responsive while the write lands, and the
    // storage subscription corrects us if the stored value differs.
    setContacts(next);
    await contactsStore.save(next);
  }, []);

  return { contacts, loaded, save };
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
