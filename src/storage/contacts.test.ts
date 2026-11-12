/**
 * The contacts module is the seam that stage 1 replaces with an API-backed
 * implementation, so its contract is pinned here: what goes in comes back, the
 * order is the user's, and garbage in storage never reaches the UI.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { installChromeStub } from '../ui/testing/chromeStub';
import {
  chromeStorageContacts,
  coerceContacts,
  emptyContact,
  mergeContacts,
  moveContact,
} from './contacts';
import type { Contact } from './types';

const contact = (label: string, value: string): Contact => ({
  id: crypto.randomUUID(),
  label,
  value,
});

beforeEach(() => {
  installChromeStub();
});

describe('chromeStorageContacts', () => {
  it('returns an empty list when nothing is stored', async () => {
    expect(await chromeStorageContacts.list()).toEqual([]);
  });

  it('stores and reads back the list in order', async () => {
    const list = [contact('Telegram', '@theermek'), contact('GitHub', 'github.com/theermek')];

    await chromeStorageContacts.save(list);

    expect((await chromeStorageContacts.list()).map((c) => c.label)).toEqual([
      'Telegram',
      'GitHub',
    ]);
  });

  it('trims values and drops rows left completely empty', async () => {
    const saved = await chromeStorageContacts.save([
      contact('  Telegram  ', '  @theermek  '),
      contact('   ', '   '),
    ]);

    expect(saved).toEqual([
      expect.objectContaining({ label: 'Telegram', value: '@theermek' }),
    ]);
  });

  it('notifies subscribers when another page changes the list', async () => {
    const seen: string[] = [];
    const unsubscribe = chromeStorageContacts.subscribe((next) => {
      seen.push(...next.map((c) => c.label));
    });

    await chromeStorageContacts.save([contact('Email', 'a@b.c')]);
    unsubscribe();
    await chromeStorageContacts.save([contact('LinkedIn', 'in/theermek')]);

    // Only the change made while subscribed is reported.
    expect(seen).toEqual(['Email']);
  });
});

describe('coerceContacts', () => {
  it('ignores anything that is not a label/value pair', () => {
    const result = coerceContacts([
      { label: 'Telegram', value: '@theermek' },
      { label: 'no value' },
      'nonsense',
      null,
      42,
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.label).toBe('Telegram');
  });

  it('invents an id for a record stored without one', () => {
    expect(coerceContacts([{ label: 'Telegram', value: '@theermek' }])[0]?.id).toBeTruthy();
  });

  it('treats a non-array as no contacts at all', () => {
    expect(coerceContacts({ label: 'x', value: 'y' })).toEqual([]);
    expect(coerceContacts(undefined)).toEqual([]);
  });
});

describe('moveContact', () => {
  const list = [contact('a', '1'), contact('b', '2'), contact('c', '3')];

  it('swaps a row with its neighbour', () => {
    expect(moveContact(list, 2, -1).map((c) => c.label)).toEqual(['a', 'c', 'b']);
    expect(moveContact(list, 0, 1).map((c) => c.label)).toEqual(['b', 'a', 'c']);
  });

  it('leaves the list alone at the edges, so the UI needs no special cases', () => {
    expect(moveContact(list, 0, -1)).toBe(list);
    expect(moveContact(list, 2, 1)).toBe(list);
    expect(moveContact(list, 7, 1)).toBe(list);
  });
});

describe('mergeContacts', () => {
  it('adds new pairs and skips ones already present', () => {
    const current = [contact('Telegram', '@theermek')];
    const incoming = [contact('Telegram', '@theermek'), contact('GitHub', 'github.com/theermek')];

    const merged = mergeContacts(current, incoming);

    expect(merged.map((c) => c.label)).toEqual(['Telegram', 'GitHub']);
  });

  it('re-keys imported contacts so a foreign id cannot collide', () => {
    const imported: Contact = { id: 'foreign-id', label: 'Email', value: 'a@b.c' };

    expect(mergeContacts([], [imported])[0]?.id).not.toBe('foreign-id');
  });
});

describe('emptyContact', () => {
  it('produces a blank row with its own id', () => {
    const first = emptyContact();
    expect(first).toEqual({ id: expect.any(String), label: '', value: '' });
    expect(emptyContact().id).not.toBe(first.id);
  });
});
