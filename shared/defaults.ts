/**
 * Values both sides need to agree on, with no logic attached.
 *
 * The signature templates live here because two places create them: the server
 * seeds them into a brand-new profile row, and the extension shows them in the
 * options form. Duplicating the strings would let the two drift apart.
 */

export const DEFAULT_SIGNATURE_RU = 'Телеграм для связи: @theermek, с уважением, Эрмек Акелов';
export const DEFAULT_SIGNATURE_EN = 'Telegram: @theermek. Best regards, Ermek Akelov';
