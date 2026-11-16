import { ZodError } from 'zod';
import { logger } from '../config/logger.js';

export function notFound(_req, _res, next) {
  next(Object.assign(new Error('Route not found'), { status: 404, code: 'NOT_FOUND' }));
}

export function errorHandler(error, req, res, _next) {
  const status = error instanceof ZodError ? 400 : (error.status || 500);
  const code = error instanceof ZodError ? 'VALIDATION_ERROR' : (error.code || 'INTERNAL_ERROR');
  const message = error instanceof ZodError ? 'The request was invalid.' : (status >= 500 ? 'An unexpected server error occurred.' : error.message);
  if (status >= 500) logger.error({ err: error, requestId: req.id }, 'Request failed');
  res.status(status).json({ error: { code, message, requestId: req.id } });
}
