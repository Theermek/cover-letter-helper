/**
 * Deduplication hash for vacancy texts (TASK §7).
 *
 * Normalisation is deliberately aggressive: the same vacancy copied from two
 * sites differs in whitespace, quotes and casing, and all of those must land on
 * one record. Uses WebCrypto, available in the service worker and in pages.
 */

export const normalizeForHash = (text: string): string =>
  text
    .toLowerCase()
    .replace(/ /g, ' ')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‒-―−]/g, '-')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

export const sha256Hex = async (input: string): Promise<string> => {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

export const vacancyTextHash = (text: string): Promise<string> =>
  sha256Hex(normalizeForHash(text));
