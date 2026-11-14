/**
 * Importing an export file (TASK2 §1.3).
 *
 * This is the path that carries a user's existing data onto the server, so its
 * two rules are both about not losing anything:
 *
 *  - vacancies are deduplicated by text hash, in the file and against the
 *    table, so importing the same file twice changes nothing;
 *  - profile fields are seeded only where the database is still empty. An
 *    import must never overwrite a CV or contacts already entered here.
 */

import {
  ImportFileSchema,
  ImportVacancySchema,
  type ImportResult,
} from '../../../../shared/dto/importFile.js';
import { normalizeHardSkills, normalizeSoftSkills } from '../stats/skillNormalize.js';
import { ensureProfile, updateProfile } from '../profile/repository.js';
import { insertNewVacancyRows } from '../vacancies/repository.js';
import type { VacancyInsert } from '../../db/schema.js';

/** A record whose own date is missing or absurd is stored as "now". */
const toDate = (epochMs: number | null | undefined): Date => {
  if (!epochMs) return new Date();
  const date = new Date(epochMs);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

export const importData = async (payload: unknown): Promise<ImportResult> => {
  const file = ImportFileSchema.parse(payload);

  const rows: Omit<VacancyInsert, 'id'>[] = [];
  const seenHashes = new Set<string>();
  let skipped = 0;

  for (const raw of file.vacancies) {
    const parsed = ImportVacancySchema.safeParse(raw);
    if (!parsed.success) {
      // Not an error: an unreadable record is reported, the import goes on.
      skipped += 1;
      continue;
    }

    const record = parsed.data;
    // Deduplicate inside the file as well. Two records with the same hash in
    // one INSERT would otherwise depend on conflict handling to sort out, and
    // the count of what was imported would stop matching what happened.
    if (seenHashes.has(record.textHash)) {
      skipped += 1;
      continue;
    }
    seenHashes.add(record.textHash);

    const createdAt = toDate(record.createdAt);
    rows.push({
      sourceText: record.sourceText,
      textHash: record.textHash,
      url: record.url ?? null,
      company: record.company ?? null,
      title: record.title ?? null,
      grade: record.grade ?? null,
      workFormat: record.workFormat ?? null,
      salaryRaw: record.salaryRaw ?? null,
      salaryMin: record.salaryMin ?? null,
      salaryMax: record.salaryMax ?? null,
      salaryCurrency: record.salaryCurrency ?? null,
      hardSkills: normalizeHardSkills(record.hardSkills),
      softSkills: normalizeSoftSkills(record.softSkills),
      letter: record.letter,
      // The original date is kept: "when did I first apply" is the whole value
      // of the archive, and stamping everything with the import date erases it.
      createdAt,
      updatedAt: new Date(),
    });
  }

  const imported = await insertNewVacancyRows(rows);
  // Whatever the database refused was already stored under that hash.
  skipped += rows.length - imported;

  const seededProfileFields = await seedProfile(file);

  return { imported, skipped, seededProfileFields };
};

/** Fills only the profile fields that are still empty here. */
const seedProfile = async (
  file: ReturnType<typeof ImportFileSchema.parse>,
): Promise<string[]> => {
  const current = await ensureProfile();
  const patch: Parameters<typeof updateProfile>[0] = {};
  const seeded: string[] = [];

  const cvText = file.settings?.cvText?.trim();
  if (cvText && current.cvText.trim() === '') {
    patch.cvText = cvText;
    seeded.push('cvText');
  }

  const contacts = (file.contacts ?? []).filter((c) => c.label.trim() || c.value.trim());
  if (contacts.length > 0 && current.contacts.length === 0) {
    patch.contacts = contacts.map((contact, index) => ({
      // An id from another machine may collide; the list is identified by
      // position and content, never by an id travelling in a file.
      id: contact.id || `imported-${index}-${Date.now()}`,
      label: contact.label,
      value: contact.value,
    }));
    seeded.push('contacts');
  }

  const signature = file.settings?.signature;
  if (signature && current.signatureRu.trim() === '' && current.signatureEn.trim() === '') {
    patch.signatureEnabled = signature.enabled;
    patch.signatureRu = signature.ru;
    patch.signatureEn = signature.en;
    seeded.push('signature');
  }

  if (Object.keys(patch).length > 0) await updateProfile(patch);
  return seeded;
};
