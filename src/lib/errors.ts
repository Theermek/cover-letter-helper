/**
 * Provider errors are normalised here so the UI never shows a raw API payload
 * (TASK §4.3, §11). Every user-facing message is in Russian and actionable.
 */

export const ERROR_KINDS = [
  'invalid_key',
  'no_model_access',
  'rate_limit',
  'quota',
  'network',
  'bad_response',
  'timeout',
  'unknown',
] as const;

export type ErrorKind = (typeof ERROR_KINDS)[number];

export interface AppErrorShape {
  readonly kind: ErrorKind;
  readonly message: string;
  /** Technical detail kept for the console only -- never rendered in the UI. */
  readonly detail?: string | undefined;
}

export class AppError extends Error implements AppErrorShape {
  readonly kind: ErrorKind;
  readonly detail: string | undefined;

  constructor(kind: ErrorKind, message: string, detail?: string) {
    super(message);
    this.name = 'AppError';
    this.kind = kind;
    this.detail = detail;
  }

  toShape(): AppErrorShape {
    return this.detail === undefined
      ? { kind: this.kind, message: this.message }
      : { kind: this.kind, message: this.message, detail: this.detail };
  }
}

const MESSAGES: Readonly<Record<ErrorKind, string>> = {
  invalid_key: 'Ключ не принят провайдером. Проверьте, что он скопирован целиком и не отозван.',
  no_model_access:
    'У этого ключа нет доступа к выбранной модели. Выберите другую модель в настройках.',
  rate_limit: 'Слишком много запросов к провайдеру. Подождите немного и попробуйте снова.',
  quota: 'На счету провайдера закончились средства или исчерпан лимит.',
  network: 'Не удалось связаться с провайдером. Проверьте интернет-соединение.',
  bad_response: 'Модель вернула ответ в неожиданном формате. Попробуйте сгенерировать заново.',
  timeout: 'Провайдер не ответил вовремя. Попробуйте ещё раз.',
  unknown: 'Не удалось выполнить запрос. Попробуйте ещё раз.',
};

export const appError = (kind: ErrorKind, detail?: string): AppError =>
  new AppError(kind, MESSAGES[kind], detail);

/** Maps an HTTP status from any provider onto a normalised error kind. */
export const kindFromStatus = (status: number): ErrorKind => {
  if (status === 401 || status === 403) return 'invalid_key';
  if (status === 404) return 'no_model_access';
  if (status === 429) return 'rate_limit';
  if (status === 402) return 'quota';
  if (status === 408 || status === 504) return 'timeout';
  if (status >= 500) return 'network';
  return 'unknown';
};

const statusOf = (error: unknown): number | undefined => {
  if (typeof error !== 'object' || error === null) return undefined;
  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' ? status : undefined;
};

/**
 * Last-resort conversion for anything thrown by a provider SDK. Specific
 * providers refine this where their SDK exposes richer error types.
 */
export const toAppError = (error: unknown): AppError => {
  if (error instanceof AppError) return error;

  const detail = error instanceof Error ? error.message : String(error);
  const status = statusOf(error);
  if (status !== undefined) {
    // A 400 mentioning the model usually means the model id is wrong or the
    // account cannot use it -- more useful than a generic "bad request".
    if (status === 400 && /model/i.test(detail)) return appError('no_model_access', detail);
    return appError(kindFromStatus(status), detail);
  }

  if (error instanceof Error && /fetch|network|ENOTFOUND|ECONNREFUSED/i.test(error.message)) {
    return appError('network', detail);
  }
  return appError('unknown', detail);
};

export const isAppErrorShape = (value: unknown): value is AppErrorShape =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as AppErrorShape).message === 'string' &&
  (ERROR_KINDS as readonly string[]).includes((value as AppErrorShape).kind);
