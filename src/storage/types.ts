/**
 * Shapes persisted in IndexedDB (TASK §7). Kept free of any `idb` import so
 * that pure logic (statistics, normalisation) can depend on them in unit tests.
 */

import type { SoftSkillCategory } from '../config/softSkills';
import type { Grade, RequirementMode, WorkFormat } from '../schema/response';

export interface HardSkill {
  name: string;
  /** The wording the vacancy actually used, for "in what form" reporting. */
  context: string;
  required: boolean;
}

export interface SoftSkill {
  name: SoftSkillCategory;
  context: string;
  required: boolean;
}

export interface VacancyRecord {
  id: string;
  createdAt: number;
  /** Set when an existing record is refreshed by a repeat generation. */
  updatedAt: number;
  sourceText: string;
  /** SHA-256 of the normalised source text -- the deduplication key. */
  textHash: string;
  company: string | null;
  title: string | null;
  grade: Grade | null;
  workFormat: WorkFormat | null;
  hardSkills: HardSkill[];
  softSkills: SoftSkill[];
  letter: string;
}

export interface CompanyRequirements {
  found: boolean;
  mode: RequirementMode;
  phrase: string | null;
  description: string | null;
}

/** Bumped when the export file format changes, so imports can migrate. */
export const EXPORT_SCHEMA_VERSION = 1;

export interface ExportFile {
  schemaVersion: number;
  exportedAt: number;
  vacancies: VacancyRecord[];
  /** Settings minus every API key -- keys are never exported (TASK §9). */
  settings: {
    provider: string | null;
    model: string | null;
    cvText: string;
    defaultLanguage: string;
    defaultLength: string;
  } | null;
}
