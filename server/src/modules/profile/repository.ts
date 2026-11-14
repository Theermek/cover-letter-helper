/**
 * Profile persistence: the only file in this module that knows SQL (TASK2 §1).
 *
 * The layering is routes -> service -> repository. The point of the bottom
 * layer is that "how it is stored" stays in one place: the service below talks
 * about a profile, not about rows, columns or jsonb.
 */

import { eq } from 'drizzle-orm';
import {
  DEFAULT_SIGNATURE_EN,
  DEFAULT_SIGNATURE_RU,
} from '../../../../shared/defaults.js';
import { db } from '../../db/client.js';
import { profile, type ProfileRow } from '../../db/schema.js';

/** The profile is a single row; its id is fixed by a CHECK in the schema. */
const PROFILE_ID = 1;

export const findProfile = async (): Promise<ProfileRow | undefined> => {
  const rows = await db.select().from(profile).where(eq(profile.id, PROFILE_ID)).limit(1);
  return rows[0];
};

/**
 * Creates the row on first use. An empty database must behave like a profile
 * that exists and is blank, otherwise every reader would need a null branch.
 */
export const ensureProfile = async (): Promise<ProfileRow> => {
  const existing = await findProfile();
  if (existing) return existing;

  const inserted = await db
    .insert(profile)
    // Seeded, not left blank: a fresh install should already have a usable
    // signature template rather than an empty textarea.
    .values({ id: PROFILE_ID, signatureRu: DEFAULT_SIGNATURE_RU, signatureEn: DEFAULT_SIGNATURE_EN })
    // Two parallel first requests would otherwise race into a duplicate key.
    .onConflictDoNothing()
    .returning();

  return inserted[0] ?? (await findProfile())!;
};

/** Applies only the given columns; absent ones keep their stored value. */
export const updateProfile = async (
  patch: Partial<Omit<ProfileRow, 'id' | 'updatedAt'>>,
): Promise<ProfileRow> => {
  await ensureProfile();

  const updated = await db
    .update(profile)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(profile.id, PROFILE_ID))
    .returning();

  return updated[0]!;
};
