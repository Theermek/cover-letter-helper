/**
 * CV input (TASK §5).
 *
 * Text is the single source of truth. A PDF is only a way to fill that text:
 * it is parsed in the page, shown in the textarea for review, and never stored.
 */

import { useCallback, useRef, useState } from 'react';
import { STRINGS } from '../../config/strings';
import { countWords } from '../../lib/sanitizer';
import { extractPdfText } from '../../lib/pdf';
import { useFlash } from '../hooks';

interface Props {
  value: string;
  onChange: (text: string) => void;
  /**
   * Persist handler. Given one, the editor saves on blur and after a PDF
   * import; without one it only reports changes and the owner saves (that is
   * how onboarding uses it, where saving happens on "Готово").
   */
  onSave?: (text: string) => Promise<void>;
  rows?: number;
}

export const CvEditor = ({ value, onChange, onSave, rows = 12 }: Props) => {
  const fileInput = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, flashSaved] = useFlash();

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setParsing(true);
      setError(null);
      try {
        const text = await extractPdfText(file);
        onChange(text);
        if (onSave) await onSave(text);
        flashSaved(STRINGS.cv.pdfParsed);
      } catch (err) {
        console.warn('[cover-letter] не удалось разобрать PDF', err);
        setError(STRINGS.cv.pdfError);
      } finally {
        setParsing(false);
        // Allow re-picking the same file.
        if (fileInput.current) fileInput.current.value = '';
      }
    },
    [onChange, onSave, flashSaved],
  );

  const persist = useCallback(() => {
    if (!onSave) return;
    void onSave(value).then(() => flashSaved(STRINGS.common.saved));
  }, [onSave, value, flashSaved]);

  return (
    <div className="stack-sm">
      <p className="hint">{STRINGS.cv.description}</p>

      <textarea
        rows={rows}
        placeholder={STRINGS.cv.placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={persist}
      />

      <div className="row">
        <button type="button" disabled={parsing} onClick={() => fileInput.current?.click()}>
          {parsing ? STRINGS.cv.parsingPdf : STRINGS.cv.uploadPdf}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/pdf,.pdf"
          hidden
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
        <span className="spacer" />
        <span className="hint">{STRINGS.cv.wordCount(countWords(value))}</span>
      </div>

      {error && <p className="error">{error}</p>}
      {saved && <p className="success">{saved}</p>}
    </div>
  );
};
