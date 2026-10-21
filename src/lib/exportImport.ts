/**
 * Export, import and wipe (TASK §9).
 *
 * The export file is built from `exportableSettings`, which structurally cannot
 * contain an API key -- the guarantee is enforced by the type, not by a filter
 * someone might forget to update.
 */

import { EXPORT_SCHEMA_VERSION, type ExportFile, type VacancyRecord } from '../storage/types';
import { clearVacancies, importVacancies, listVacancies } from '../storage/db';
import { exportableSettings, getSettings } from '../storage/settings';

export const buildExport = async (): Promise<ExportFile> => {
  const [vacancies, settings] = await Promise.all([listVacancies(), getSettings()]);
  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: Date.now(),
    vacancies,
    settings: exportableSettings(settings),
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

const isVacancyRecord = (value: unknown): value is VacancyRecord => {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Partial<VacancyRecord>;
  return (
    typeof record.textHash === 'string' &&
    typeof record.sourceText === 'string' &&
    Array.isArray(record.hardSkills) &&
    Array.isArray(record.softSkills)
  );
};

/** Throws when the file is not one of ours; otherwise merges and dedupes. */
export const importFromFile = async (file: File): Promise<{ added: number; skipped: number }> => {
  const parsed: unknown = JSON.parse(await file.text());

  if (typeof parsed !== 'object' || parsed === null) throw new Error('not an export file');
  const payload = parsed as Partial<ExportFile>;
  if (!Array.isArray(payload.vacancies)) throw new Error('not an export file');

  const records = payload.vacancies.filter(isVacancyRecord);
  return importVacancies(records);
};

/** Removes vacancies, settings, keys and CV alike. */
export const deleteAllData = async (): Promise<void> => {
  await clearVacancies();
  await chrome.storage.local.clear();
};
