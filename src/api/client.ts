/**
 * The only place in the extension that calls fetch (TASK2 §1.5).
 *
 * Everything above it works with typed functions and never sees a URL, a
 * header or a status code. That boundary is what makes the server swappable and
 * the error handling uniform: every failure leaves here as the same AppError
 * the UI has always displayed, so no component had to learn new error shapes.
 */

import { AppError, appError, kindFromStatus } from '../lib/errors';
import { getSettings } from '../storage/settings';

/** A request is given up on after this: a hung server must not hang the popup. */
const TIMEOUT_MS = 60_000;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Health check only: it must work before a token is configured. */
  skipAuth?: boolean;
  timeoutMs?: number;
}

const joinUrl = (base: string, path: string): string =>
  `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;

/** The server answers errors as { error, details? }; anything else is unexpected. */
const errorMessageFrom = async (response: Response): Promise<string | undefined> => {
  try {
    const payload: unknown = await response.json();
    if (typeof payload === 'object' && payload !== null && 'error' in payload) {
      const message = (payload as { error: unknown }).error;
      if (typeof message === 'string') return message;
    }
  } catch {
    // Not JSON (a proxy's HTML error page, for instance) -- fall back below.
  }
  return undefined;
};

export const apiRequest = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const settings = await getSettings();
  const base = settings.server.url.trim();

  if (!base) {
    throw new AppError('unknown', 'Укажите адрес сервера в настройках расширения.');
  }
  if (!options.skipAuth && !settings.server.token.trim()) {
    throw new AppError('invalid_key', 'Укажите токен доступа в настройках расширения.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(joinUrl(base, path), {
      method: options.method ?? 'GET',
      headers: {
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(options.skipAuth ? {} : { Authorization: `Bearer ${settings.server.token.trim()}` }),
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      signal: controller.signal,
    });
  } catch (error) {
    // No response at all: server down, wrong port, no network, or our timeout.
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw appError('timeout', path);
    }
    throw new AppError(
      'network',
      `Сервер недоступен по адресу ${base}. Проверьте, что он запущен.`,
      error instanceof Error ? error.message : undefined,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const serverMessage = await errorMessageFrom(response);
    const kind = kindFromStatus(response.status);
    throw new AppError(
      kind,
      kind === 'invalid_key'
        ? 'Сервер не принял токен. Проверьте его в настройках.'
        : (serverMessage ?? `Сервер ответил ошибкой ${response.status}.`),
      `${response.status} ${path}`,
    );
  }

  if (response.status === 204) return undefined as T;

  try {
    return (await response.json()) as T;
  } catch (error) {
    throw appError('bad_response', error instanceof Error ? error.message : 'invalid json');
  }
};

/**
 * Liveness check for the "test connection" button. Deliberately without a
 * token: it has to distinguish "server unreachable" from "token rejected",
 * which is impossible if both answer 401.
 */
export const checkHealth = async (): Promise<void> => {
  await apiRequest<{ status: string }>('/health', { skipAuth: true, timeoutMs: 5000 });
};
