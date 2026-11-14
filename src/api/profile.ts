/**
 * Profile over HTTP (TASK2 §1.5).
 *
 * The response is validated with the same zod schema the server validates the
 * request with (shared/dto/profile.ts). A server that answers with a shape we
 * do not expect fails here, with a readable message, instead of surfacing as
 * `undefined.map is not a function` somewhere in a component.
 *
 * Cross-page sync keeps working the way it did when everything was local: a
 * save bumps a revision counter in chrome.storage, and open pages re-fetch when
 * they see it change. The data moved to the server; the notification channel
 * between extension pages is still chrome.storage.
 */

import { ProfileDtoSchema, type ProfileDto, type ProfileUpdate } from '../../shared/dto/profile';
import { appError } from '../lib/errors';
import { apiRequest } from './client';

const REVISION_KEY = 'profileRevision';

const parse = (payload: unknown): ProfileDto => {
  const result = ProfileDtoSchema.safeParse(payload);
  if (!result.success) {
    throw appError('bad_response', result.error.issues.map((i) => i.path.join('.')).join(', '));
  }
  return result.data;
};

export const fetchProfile = async (): Promise<ProfileDto> => parse(await apiRequest('/profile'));

export const saveProfile = async (patch: ProfileUpdate): Promise<ProfileDto> => {
  const profile = parse(await apiRequest('/profile', { method: 'PUT', body: patch }));
  await chrome.storage.local.set({ [REVISION_KEY]: Date.now() });
  return profile;
};

/** Fires when any extension page saves the profile. Returns an unsubscribe. */
export const onProfileChanged = (listener: () => void): (() => void) => {
  const handler = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ): void => {
    if (areaName === 'local' && REVISION_KEY in changes) listener();
  };

  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
};
