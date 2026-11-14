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
import { fetchProfile, onProfileChanged, saveProfile } from '../api/profile';
import type { ProfileDto, ProfileUpdate } from '../../shared/dto/profile';
import { isAppErrorShape } from '../lib/errors';
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
  error: string | null;
  save: (next: readonly Contact[]) => Promise<void>;
} => {
  const [contacts, setContacts] = useState<readonly Contact[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Reading can fail now that the store is the server: an unconfigured or
    // unreachable server must leave an empty list and a message, not an
    // unhandled rejection in the console.
    void contactsStore
      .list()
      .then((next) => {
        setContacts(next);
        setError(null);
      })
      .catch((failure: unknown) => {
        setError(isAppErrorShape(failure) ? failure.message : 'Не удалось загрузить контакты.');
      })
      .finally(() => setLoaded(true));

    return contactsStore.subscribe(setContacts);
  }, []);

  const save = useCallback(async (next: readonly Contact[]) => {
    // Optimistic: the editor stays responsive while the write lands, and the
    // subscription corrects us if what was stored differs.
    setContacts(next);
    try {
      setContacts(await contactsStore.save(next));
      setError(null);
    } catch (failure) {
      setError(isAppErrorShape(failure) ? failure.message : 'Не удалось сохранить контакты.');
    }
  }, []);

  return { contacts, loaded, error, save };
};

/**
 * The profile (CV, contacts, signature) from the server.
 *
 * Unlike the local hooks above, this one can fail: the server may be down or
 * the token wrong. The error is returned rather than thrown so every screen can
 * show it in place instead of rendering blank.
 */
export const useProfile = (): {
  profile: ProfileDto | null;
  loaded: boolean;
  error: string | null;
  save: (patch: ProfileUpdate) => Promise<void>;
  reload: () => void;
} => {
  const [profile, setProfile] = useState<ProfileDto | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    void fetchProfile()
      .then((next) => {
        setProfile(next);
        setError(null);
      })
      .catch((failure: unknown) => {
        setError(isAppErrorShape(failure) ? failure.message : 'Не удалось загрузить профиль.');
      })
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    load();
    // Another page saved: re-read instead of trusting our stale copy.
    return onProfileChanged(load);
  }, [load]);

  const save = useCallback(async (patch: ProfileUpdate) => {
    try {
      setProfile(await saveProfile(patch));
      setError(null);
    } catch (failure) {
      setError(isAppErrorShape(failure) ? failure.message : 'Не удалось сохранить.');
    }
  }, []);

  return { profile, loaded, error, save, reload: load };
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
