import type { Context } from 'hono';

export class HttpError extends Error {
  status: number;
  payload: Record<string, unknown>;

  constructor(status: number, message: string, payload: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

export function unauthorized(message = 'You must be signed in') {
  return new HttpError(401, message, { error: 'unauthorized' });
}

export function notFound(message = 'Not found') {
  return new HttpError(404, message, { error: 'not_found' });
}

export function badRequest(message: string, payload: Record<string, unknown> = {}) {
  return new HttpError(400, message, { error: 'invalid_request', ...payload });
}

/**
 * Matches the shape the old edge functions returned (`{ message, error }`) so the
 * client's error handling did not need to change during the migration.
 */
export function errorResponse(c: Context, error: unknown) {
  if (error instanceof HttpError) {
    return c.json({ message: error.message, ...error.payload }, error.status as 400);
  }

  console.error('Unhandled error:', error);
  const message = error instanceof Error ? error.message : 'Unknown error';
  return c.json({ message, error: 'internal_error' }, 500);
}
