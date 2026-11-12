/**
 * Contacts editing on the options page (TASK2 §0.2).
 *
 * Order is changed with up/down buttons rather than drag and drop: the list is
 * a handful of rows, and buttons work with a keyboard for free.
 */

import { useCallback } from 'react';
import { STRINGS } from '../../config/strings';
import { emptyContact, moveContact } from '../../storage/contacts';
import type { Contact } from '../../storage/types';
import { useContacts } from '../hooks';

export const ContactsEditor = () => {
  const { contacts, loaded, save } = useContacts();

  const update = useCallback(
    (id: string, patch: Partial<Contact>) => {
      void save(contacts.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    },
    [contacts, save],
  );

  const remove = useCallback(
    (id: string) => {
      void save(contacts.filter((c) => c.id !== id));
    },
    [contacts, save],
  );

  const move = useCallback(
    (index: number, offset: number) => {
      void save(moveContact(contacts, index, offset));
    },
    [contacts, save],
  );

  const add = useCallback(() => {
    void save([...contacts, emptyContact()]);
  }, [contacts, save]);

  if (!loaded) return <p className="hint">{STRINGS.common.loading}</p>;

  return (
    <div className="stack-sm">
      {contacts.length === 0 && <p className="hint">{STRINGS.contacts.empty}</p>}

      {contacts.map((contact, index) => (
        <div key={contact.id} className="row contact-edit-row">
          <input
            type="text"
            className="contact-label-input"
            placeholder={STRINGS.contacts.labelPlaceholder}
            value={contact.label}
            onChange={(e) => update(contact.id, { label: e.target.value })}
          />
          <input
            type="text"
            placeholder={STRINGS.contacts.valuePlaceholder}
            value={contact.value}
            onChange={(e) => update(contact.id, { value: e.target.value })}
          />
          <button
            type="button"
            className="ghost icon-btn"
            disabled={index === 0}
            title={STRINGS.contacts.up}
            aria-label={`${STRINGS.contacts.up}: ${contact.label}`}
            onClick={() => move(index, -1)}
          >
            ↑
          </button>
          <button
            type="button"
            className="ghost icon-btn"
            disabled={index === contacts.length - 1}
            title={STRINGS.contacts.down}
            aria-label={`${STRINGS.contacts.down}: ${contact.label}`}
            onClick={() => move(index, 1)}
          >
            ↓
          </button>
          <button
            type="button"
            className="ghost icon-btn danger-icon"
            title={STRINGS.contacts.remove}
            aria-label={`${STRINGS.contacts.remove}: ${contact.label}`}
            onClick={() => remove(contact.id)}
          >
            ✕
          </button>
        </div>
      ))}

      <div className="row">
        <button type="button" onClick={add}>
          {STRINGS.contacts.add}
        </button>
      </div>
      <p className="hint">{STRINGS.contacts.hint}</p>
    </div>
  );
};
