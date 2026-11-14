/**
 * Profile logic: the layer between HTTP and SQL (TASK2 §1).
 *
 * Its real job is translation. The database speaks snake_case rows with a
 * Date object; the API speaks camelCase JSON with an ISO string. Keeping that
 * mapping here means a column rename never reaches the extension, and the
 * extension's shape never dictates the table layout.
 */

import type { ProfileDto, ProfileUpdate } from '../../../../shared/dto/profile.js';
import type { ProfileRow } from '../../db/schema.js';
import { ensureProfile, updateProfile } from './repository.js';

const toDto = (row: ProfileRow): ProfileDto => ({
  cvText: row.cvText,
  contacts: row.contacts,
  signature: {
    enabled: row.signatureEnabled,
    ru: row.signatureRu,
    en: row.signatureEn,
  },
  updatedAt: row.updatedAt.toISOString(),
});

export const getProfile = async (): Promise<ProfileDto> => toDto(await ensureProfile());

export const saveProfile = async (patch: ProfileUpdate): Promise<ProfileDto> => {
  const columns: Parameters<typeof updateProfile>[0] = {};

  if (patch.cvText !== undefined) columns.cvText = patch.cvText;
  if (patch.contacts !== undefined) columns.contacts = patch.contacts;
  if (patch.signature !== undefined) {
    columns.signatureEnabled = patch.signature.enabled;
    columns.signatureRu = patch.signature.ru;
    columns.signatureEn = patch.signature.en;
  }

  // Nothing to write: return the current state instead of touching updatedAt.
  if (Object.keys(columns).length === 0) return getProfile();

  return toDto(await updateProfile(columns));
};
