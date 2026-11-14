/**
 * The one error type routes and services throw.
 *
 * Carrying the HTTP status on the error means a service can say "this vacancy
 * does not exist" without importing anything from Express, and the error
 * middleware turns it into a response. Anything thrown that is NOT an HttpError
 * is treated as a bug: the client gets a generic 500 and the details stay in
 * the log, so an internal message or a secret can never leak in a response.
 */

export class HttpError extends Error {
  readonly status: number;
  /** Safe to show the user; never contains internals. */
  readonly publicMessage: string;
  readonly details?: unknown;

  constructor(status: number, publicMessage: string, details?: unknown) {
    super(publicMessage);
    this.name = 'HttpError';
    this.status = status;
    this.publicMessage = publicMessage;
    if (details !== undefined) this.details = details;
  }
}

export const badRequest = (message = 'Некорректный запрос', details?: unknown): HttpError =>
  new HttpError(400, message, details);

export const unauthorized = (message = 'Нужен действующий токен доступа'): HttpError =>
  new HttpError(401, message);

export const notFound = (message = 'Не найдено'): HttpError => new HttpError(404, message);

export const serviceUnavailable = (message = 'Сервис временно недоступен'): HttpError =>
  new HttpError(503, message);
