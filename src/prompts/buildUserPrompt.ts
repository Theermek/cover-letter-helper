/**
 * The per-request user message.
 *
 * Settings are labelled with their priority number so the ladder in the system
 * prompt stays unambiguous when the user's free-text wish contradicts them.
 */

import { LENGTH_PRESETS, type LetterLanguage, type LetterLength } from '../config/lengths';

export interface GenerationRequest {
  vacancyText: string;
  cvText: string;
  language: LetterLanguage;
  length: LetterLength;
  /** Free-text wishes from the popup; optional. */
  userPrompt: string;
  /** When true the letter must end without a signature; code appends it. */
  withSignature: boolean;
}

const LANGUAGE_INSTRUCTION: Readonly<Record<LetterLanguage, string>> = {
  ru: 'русский',
  en: 'английский',
  auto: 'тот же, на котором написана вакансия',
};

export const buildUserPrompt = (request: GenerationRequest): string => {
  const preset = LENGTH_PRESETS[request.length];
  const wish = request.userPrompt.trim();

  const sections = [
    `# ТЕКСТ ВАКАНСИИ\n"""\n${request.vacancyText.trim()}\n"""`,
    `# CV СОИСКАТЕЛЯ\nЕдинственный источник фактов о соискателе. Всё, чего здесь нет, не существует.\n"""\n${request.cvText.trim()}\n"""`,
    `# НАСТРОЙКИ (приоритет 4)\nЯзык письма: ${LANGUAGE_INSTRUCTION[request.language]}.\nДлина: ${preset.label}, ориентир ${preset.minWords}-${preset.maxWords} слов.${
      request.withSignature
        ? '\nПодпись: не пиши. Ни прощания, ни имени, ни контактов в конце - их добавит код после тебя.'
        : ''
    }`,
  ];

  sections.push(
    wish
      ? `# ПОЖЕЛАНИЯ ПОЛЬЗОВАТЕЛЯ (приоритет 3, выше настроек, ниже требований компании и честности)\n"""\n${wish}\n"""`
      : '# ПОЖЕЛАНИЯ ПОЛЬЗОВАТЕЛЯ\nНет.',
  );

  sections.push('Верни один JSON-объект по схеме. Больше ничего.');

  return sections.join('\n\n');
};
