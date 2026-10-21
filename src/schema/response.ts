/**
 * The contract for a single generation request (TASK §6.7).
 *
 * One schema serves three roles:
 *  - it is handed to the provider as a structured-output format, so the model
 *    is constrained rather than merely asked;
 *  - it validates what comes back;
 *  - it documents the shape for the rest of the app.
 *
 * Two variants exist on purpose. `ModelResponseSchema` is the strict one sent to
 * providers (no optionals, no unions beyond nullable -- OpenAI strict mode and
 * Gemini both reject richer constructs). `LenientResponseSchema` is what we
 * actually parse with: a model that answers "Senior" instead of "senior" should
 * not cost the user a whole generation, so unknown enum values degrade to null.
 */

import { z } from 'zod';
import { SOFT_SKILL_CATEGORIES } from '../config/softSkills';

export const GRADES = ['junior', 'middle', 'senior', 'lead'] as const;
export const WORK_FORMATS = ['remote', 'office', 'hybrid'] as const;
export const REQUIREMENT_MODES = ['include_phrase', 'only_phrase', 'none'] as const;

export type Grade = (typeof GRADES)[number];
export type WorkFormat = (typeof WORK_FORMATS)[number];
export type RequirementMode = (typeof REQUIREMENT_MODES)[number];

const HardSkill = z.object({
  name: z.string(),
  context: z.string(),
  required: z.boolean(),
});

const SoftSkill = z.object({
  name: z.enum(SOFT_SKILL_CATEGORIES),
  context: z.string(),
  required: z.boolean(),
});

export const ModelResponseSchema = z.object({
  letter: z.string(),
  companyRequirements: z.object({
    found: z.boolean(),
    mode: z.enum(REQUIREMENT_MODES),
    /** The exact wording to reproduce verbatim; null when `mode` is "none". */
    phrase: z.string().nullable(),
    description: z.string().nullable(),
  }),
  vacancy: z.object({
    company: z.string().nullable(),
    title: z.string().nullable(),
    grade: z.enum(GRADES).nullable(),
    workFormat: z.enum(WORK_FORMATS).nullable(),
  }),
  skills: z.object({
    hard: z.array(HardSkill),
    soft: z.array(SoftSkill),
  }),
});

export type ModelResponse = z.infer<typeof ModelResponseSchema>;

/** Maps anything unrecognised onto null instead of failing the whole parse. */
const lenientEnum = <T extends readonly string[]>(values: T) =>
  z.preprocess((value) => {
    if (typeof value !== 'string') return null;
    const match = values.find((v) => v.toLowerCase() === value.trim().toLowerCase());
    return match ?? null;
  }, z.enum(values as unknown as [string, ...string[]]).nullable());

const lenientSoftName = z.preprocess((value) => {
  if (typeof value !== 'string') return 'Other';
  const match = SOFT_SKILL_CATEGORIES.find(
    (v) => v.toLowerCase() === value.trim().toLowerCase(),
  );
  return match ?? 'Other';
}, z.enum(SOFT_SKILL_CATEGORIES));

const nullableString = z.preprocess((value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}, z.string().nullable());

const skillArray = <T extends z.ZodTypeAny>(nameSchema: T) =>
  z.preprocess(
    (value) => (Array.isArray(value) ? value : []),
    z.array(
      z.object({
        name: nameSchema,
        context: z.preprocess(
          (v) => (typeof v === 'string' ? v.trim() : ''),
          z.string(),
        ),
        required: z.preprocess((v) => v === true, z.boolean()),
      }),
    ),
  );

export const LenientResponseSchema = z.object({
  letter: z.string(),
  companyRequirements: z.preprocess(
    (value) => (typeof value === 'object' && value !== null ? value : {}),
    z.object({
      found: z.preprocess((v) => v === true, z.boolean()),
      mode: z.preprocess((value) => {
        if (typeof value !== 'string') return 'none';
        const match = REQUIREMENT_MODES.find(
          (v) => v.toLowerCase() === value.trim().toLowerCase(),
        );
        return match ?? 'none';
      }, z.enum(REQUIREMENT_MODES)),
      phrase: nullableString,
      description: nullableString,
    }),
  ),
  vacancy: z.preprocess(
    (value) => (typeof value === 'object' && value !== null ? value : {}),
    z.object({
      company: nullableString,
      title: nullableString,
      grade: lenientEnum(GRADES),
      workFormat: lenientEnum(WORK_FORMATS),
    }),
  ),
  skills: z.preprocess(
    (value) => (typeof value === 'object' && value !== null ? value : {}),
    z.object({
      hard: skillArray(z.preprocess((v) => (typeof v === 'string' ? v.trim() : ''), z.string())),
      soft: skillArray(lenientSoftName),
    }),
  ),
});

export type ParsedResponse = {
  letter: string;
  companyRequirements: {
    found: boolean;
    mode: RequirementMode;
    phrase: string | null;
    description: string | null;
  };
  vacancy: {
    company: string | null;
    title: string | null;
    grade: Grade | null;
    workFormat: WorkFormat | null;
  };
  skills: {
    hard: { name: string; context: string; required: boolean }[];
    soft: { name: (typeof SOFT_SKILL_CATEGORIES)[number]; context: string; required: boolean }[];
  };
};

/**
 * Pulls a JSON object out of text that may be wrapped in a code fence or carry
 * a stray trailing comma. Cheap repair before spending another API call.
 */
export const extractJson = (raw: string): unknown => {
  const withoutFence = raw
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  const start = withoutFence.indexOf('{');
  const end = withoutFence.lastIndexOf('}');
  const candidate = start >= 0 && end > start ? withoutFence.slice(start, end + 1) : withoutFence;

  try {
    return JSON.parse(candidate);
  } catch {
    // Trailing commas are the single most common malformation.
    const repaired = candidate.replace(/,(\s*[}\]])/g, '$1');
    return JSON.parse(repaired);
  }
};

/** Throws a ZodError (or SyntaxError) when the payload cannot be salvaged. */
export const parseModelResponse = (payload: unknown): ParsedResponse => {
  const source = typeof payload === 'string' ? extractJson(payload) : payload;
  return LenientResponseSchema.parse(source) as ParsedResponse;
};

/** JSON Schema for providers that take a raw schema rather than a zod object. */
export const responseJsonSchema = (): Record<string, unknown> =>
  z.toJSONSchema(ModelResponseSchema, { target: 'draft-7' }) as Record<string, unknown>;
