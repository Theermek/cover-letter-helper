/**
 * The profile contract, shared by the server and the extension (TASK2 §1).
 *
 * One zod schema, two jobs: the server validates incoming requests with it, the
 * extension validates what comes back. A field renamed here becomes a type
 * error on both sides at once, which is the whole point of putting it in
 * shared/ rather than describing the shape twice.
 *
 * Field names are camelCase: this is the API shape, not the database shape. The
 * database uses snake_case and the repository maps between them.
 */

import { z } from 'zod';

export const ContactDtoSchema = z.object({
  id: z.string().min(1),
  label: z.string().max(60),
  value: z.string().max(400),
});

export const SignatureDtoSchema = z.object({
  enabled: z.boolean(),
  ru: z.string().max(500),
  en: z.string().max(500),
});

export const ProfileDtoSchema = z.object({
  // Generous but finite: a CV is a few pages of text, not a book.
  cvText: z.string().max(100_000),
  contacts: z.array(ContactDtoSchema).max(50),
  signature: SignatureDtoSchema,
  /** ISO-8601, set by the server; ignored on input. */
  updatedAt: z.string(),
});

/**
 * A PUT may carry only the parts that changed: the options page saves the CV
 * and the contacts editor saves contacts, and neither should have to send the
 * other back to avoid clobbering it.
 */
export const ProfileUpdateSchema = ProfileDtoSchema.omit({ updatedAt: true }).partial();

export type ContactDto = z.infer<typeof ContactDtoSchema>;
export type SignatureDto = z.infer<typeof SignatureDtoSchema>;
export type ProfileDto = z.infer<typeof ProfileDtoSchema>;
export type ProfileUpdate = z.infer<typeof ProfileUpdateSchema>;
