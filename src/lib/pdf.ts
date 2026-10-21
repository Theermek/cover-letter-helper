/**
 * PDF text extraction for CV upload (TASK §5).
 *
 * The worker is bundled locally and referenced through a Vite `?url` import:
 * MV3's content security policy forbids loading it from a CDN, and the legacy
 * build is used because it avoids syntax the extension's target may not accept.
 *
 * The PDF itself is never stored -- only the extracted text, which the user
 * reviews and edits. `cvText` stays the single source of truth.
 */

import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

interface TextItemLike {
  str?: unknown;
  hasEOL?: unknown;
}

/** Joins the text items of one page, honouring the end-of-line flags. */
const pageToText = (items: readonly TextItemLike[]): string => {
  let out = '';
  for (const item of items) {
    if (typeof item.str !== 'string') continue;
    out += item.str;
    if (item.hasEOL === true) out += '\n';
    else if (!item.str.endsWith(' ')) out += ' ';
  }
  return out;
};

const tidy = (text: string): string =>
  text
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

export const extractPdfText = async (file: File): Promise<string> => {
  const data = new Uint8Array(await file.arrayBuffer());
  // Teardown lives on the loading task, not on the document proxy.
  const loadingTask = pdfjs.getDocument({ data });
  const doc = await loadingTask.promise;

  try {
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(pageToText(content.items as TextItemLike[]));
    }
    return tidy(pages.join('\n\n'));
  } finally {
    await loadingTask.destroy();
  }
};
