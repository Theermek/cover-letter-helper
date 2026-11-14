/**
 * Export, import, local migration and wipe (TASK §9, TASK2 §1.3).
 *
 * The export file is built from `exportableSettings`, which structurally cannot
 * contain an API key -- the guarantee is enforced by the type, not by a filter
 * someone might forget to update.
 *
 * Since the data moved to the server there are two different "all my data":
 *  - `buildExport` is the current state, read back from the server;
 *  - `buildLocalSnapshot` is what is still sitting in this browser from before
 *    the move, and it exists only to be handed to `POST /import` once.
 */

import { EXPORT_SCHEMA_VERSION, type ExportFile } from '../storage/types';
import { clearVacancies, listVacancies as listLocalVacancies } from '../storage/db';
import { exportableSettings, getSettings } from '../storage/settings';
import { chromeStorageContacts, contactsStore } from '../storage/contacts';
import { fetchProfile } from '../api/profile';
import { fetchVacancies, importData } from '../api/vacancies';
import type { ImportResult } from '../../shared/dto/importFile';
import type { VacancyDto } from '../../shared/dto/vacancy';

/** One request cannot ask for more than this, so the export pages through. */
const PAGE_SIZE = 200;

/** Export keeps epoch milliseconds, which is what the file format has always used. */
const toExportVacancy = (vacancy: VacancyDto) => ({
  ...vacancy,
  createdAt: Date.parse(vacancy.createdAt),
  updatedAt: Date.parse(vacancy.updatedAt),
});

const fetchAllVacancies = async (): Promise<VacancyDto[]> => {
  const all: VacancyDto[] = [];
  let offset = 0;

  // Paging rather than one huge request: the server caps `limit`, and a full
  // archive could otherwise be a response big enough to be a problem.
  for (;;) {
    const page = await fetchVacancies(PAGE_SIZE, offset);
    all.push(...page.items);
    offset += page.items.length;
    if (page.items.length === 0 || all.length >= page.total) break;
  }

  return all;
};

export const buildExport = async (): Promise<ExportFile> => {
  const [vacancies, profile, settings, contacts] = await Promise.all([
    fetchAllVacancies(),
    fetchProfile(),
    getSettings(),
    contactsStore.list(),
  ]);

  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: Date.now(),
    vacancies: vacancies.map(toExportVacancy) as ExportFile['vacancies'],
    contacts: [...contacts],
    settings: {
      ...exportableSettings(settings),
      // The CV and the signature live on the server now, so they come from the
      // profile rather than from the stale copy left in chrome.storage.
      cvText: profile.cvText,
      signature: profile.signature,
    },
  };
};

export const downloadExport = async (): Promise<void> => {
  const payload = await buildExport();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const stamp = new Date().toISOString().slice(0, 10);
  const link = document.createElement('a');
  link.href = url;
  link.download = `cover-letter-helper-${stamp}.json`;
  link.click();

  URL.revokeObjectURL(url);
};

/**
 * Everything this browser still holds from before the server existed, in the
 * export file's shape so that the same `POST /import` handles it.
 */
export const buildLocalSnapshot = async (): Promise<ExportFile> => {
  const [vacancies, settings, contacts] = await Promise.all([
    listLocalVacancies(),
    getSettings(),
    // The legacy store on purpose: the point is to read what is in the browser,
    // not what the server already has.
    chromeStorageContacts.list(),
  ]);

  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: Date.now(),
    vacancies,
    contacts: [...contacts],
    settings: exportableSettings(settings),
  };
};

/** Sends the leftover local data to the server. Safe to run twice. */
export const migrateLocalDataToServer = async (): Promise<ImportResult> =>
  importData(await buildLocalSnapshot());

/**
 * Hands the file to the server as it is. Validation, deduplication and the
 * "do not overwrite what is already filled in" rule all live there, so an old
 * file and a current one go down exactly the same path.
 */
export const importFromFile = async (file: File): Promise<ImportResult> => {
  const parsed: unknown = JSON.parse(await file.text());

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('not an export file');
  }
  if (!Array.isArray((parsed as Partial<ExportFile>).vacancies)) {
    throw new Error('not an export file');
  }

  return importData(parsed);
};

/**
 * Clears this browser: settings, provider keys and the legacy local database.
 *
 * Deliberately does NOT touch the server. A one-click irreversible wipe of the
 * database behind a button that predates it is not something to do silently;
 * the hint next to the button says so.
 */
export const deleteBrowserData = async (): Promise<void> => {
  await clearVacancies();
  await chrome.storage.local.clear();
};
