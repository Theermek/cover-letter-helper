/**
 * "My contacts" in the generation screen (TASK2 §0.2).
 *
 * Collapsed by default in the popup: the letter is the point of that screen, and
 * an always-open list would push the result below the scroll edge -- the exact
 * problem the copy button had.
 */

import { useCallback, useState } from 'react';
import { STRINGS } from '../../config/strings';
import type { Contact } from '../../storage/types';
import { useContacts } from '../hooks';

interface Props {
  /** The roomier editor page can afford to show the list expanded. */
  defaultOpen?: boolean;
}

export const ContactsBlock = ({ defaultOpen = false }: Props) => {
  const { contacts, loaded } = useContacts();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const copy = useCallback((contact: Contact) => {
    void navigator.clipboard
      .writeText(contact.value)
      .then(() => {
        setError(null);
        setCopiedId(contact.id);
        setTimeout(() => setCopiedId(null), 1500);
      })
      .catch(() => setError(STRINGS.generation.copyError));
  }, []);

  if (!loaded || contacts.length === 0) return null;

  return (
    <details className="contacts" open={defaultOpen}>
      <summary>{STRINGS.contacts.summary(contacts.length)}</summary>
      <ul className="contact-list">
        {contacts.map((contact) => (
          <li key={contact.id} className="row-between contact-row">
            <span className="contact-label">{contact.label}</span>
            <span className="contact-value" title={contact.value}>
              {contact.value}
            </span>
            <button
              type="button"
              className="ghost icon-btn"
              title={STRINGS.contacts.copyValue(contact.label)}
              aria-label={STRINGS.contacts.copyValue(contact.label)}
              onClick={() => copy(contact)}
            >
              {copiedId === contact.id ? '✓' : '⧉'}
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="error">{error}</p>}
    </details>
  );
};
