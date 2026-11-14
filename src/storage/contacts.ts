/**
 * Contacts storage (TASK2 §0.2).
 *
 * Deliberately behind an interface. On stage 1 the contacts move to the server,
 * and the only thing that must change then is the implementation below -- no
 * component ever touches chrome.storage for contacts, so none of them has to be
 * rewritten when the backend appears.
 */

import { fetchProfile, onProfileChanged, saveProfile } from '../api/profile';
import type { Contact } from './types';

export interface ContactsStore {
  list(): Promise<readonly Contact[]>;
  /** Replaces the whole list; returns what was stored. */
  save(contacts: readonly Contact[]): Promise<readonly Contact[]>;
  /** Fires on every change, including ones made by another open page. */
  subscribe(listener: (contacts: readonly Contact[]) => void): () => void;
}

const CONTACTS_KEY = 'contacts';

/** Defensive read: storage may hold anything, including data from an older version. */
export const coerceContacts = (raw: unknown): readonly Contact[] => {
  if (!Array.isArray(raw)) return [];

  const contacts: Contact[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const candidate = item as Partial<Contact>;
    if (typeof candidate.label !== 'string' || typeof candidate.value !== 'string') continue;
    contacts.push({
      id: typeof candidate.id === 'string' && candidate.id ? candidate.id : crypto.randomUUID(),
      label: candidate.label,
      value: candidate.value,
    });
  }
  return contacts;
};

export const chromeStorageContacts: ContactsStore = {
  async list() {
    const stored = await chrome.storage.local.get(CONTACTS_KEY);
    return coerceContacts(stored[CONTACTS_KEY]);
  },

  async save(contacts) {
    const clean = contacts
      .map((contact) => ({ ...contact, label: contact.label.trim(), value: contact.value.trim() }))
      .filter((contact) => contact.label !== '' || contact.value !== '');
    await chrome.storage.local.set({ [CONTACTS_KEY]: clean });
    return clean;
  },

  subscribe(listener) {
    const handler = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ): void => {
      if (areaName !== 'local' || !(CONTACTS_KEY in changes)) return;
      listener(coerceContacts(changes[CONTACTS_KEY]?.newValue));
    };

    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  },
};

/**
 * Contacts on the server (TASK2 §1.5). This is the payoff of having declared
 * ContactsStore in stage 0: the components, the editor and the popup block are
 * untouched by the move -- only this implementation is new.
 *
 * There is no server-side change feed, so cross-page sync reuses the revision
 * counter that saveProfile bumps in chrome.storage: another page sees it change
 * and re-reads the list.
 */
export const apiContacts: ContactsStore = {
  async list() {
    return (await fetchProfile()).contacts;
  },

  async save(contacts) {
    const clean = contacts
      .map((contact) => ({ ...contact, label: contact.label.trim(), value: contact.value.trim() }))
      .filter((contact) => contact.label !== '' || contact.value !== '');
    return (await saveProfile({ contacts: clean })).contacts;
  },

  subscribe(listener) {
    return onProfileChanged(() => {
      void fetchProfile()
        .then((profile) => listener(profile.contacts))
        // A failed refresh must not break the subscription; the page shows its
        // own error state when a read it asked for fails.
        .catch(() => undefined);
    });
  },
};

/** The one instance the app uses. */
export const contactsStore: ContactsStore = apiContacts;

export const emptyContact = (): Contact => ({ id: crypto.randomUUID(), label: '', value: '' });

/**
 * Pure reordering helper used by the up/down buttons. Out-of-range moves return
 * the list unchanged, so the first and last rows need no special-casing in the UI.
 */
export const moveContact = (
  contacts: readonly Contact[],
  index: number,
  offset: number,
): readonly Contact[] => {
  const target = index + offset;
  if (index < 0 || index >= contacts.length || target < 0 || target >= contacts.length) {
    return contacts;
  }

  const next = [...contacts];
  const moved = next[index];
  const displaced = next[target];
  if (!moved || !displaced) return contacts;

  next[index] = displaced;
  next[target] = moved;
  return next;
};

/** Merges imported contacts, skipping pairs that are already present. */
export const mergeContacts = (
  current: readonly Contact[],
  incoming: readonly Contact[],
): readonly Contact[] => {
  const seen = new Set(current.map((c) => `${c.label}\u0000${c.value}`));
  const added: Contact[] = [];

  for (const contact of incoming) {
    const key = `${contact.label}\u0000${contact.value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    added.push({ ...contact, id: crypto.randomUUID() });
  }

  return [...current, ...added];
};
