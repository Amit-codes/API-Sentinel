import { randomBytes, timingSafeEqual } from 'node:crypto';
import { HttpError } from '../shared/HttpError.js';

export function getCsrfToken(req) {
  if (!req.session.csrfToken) req.session.csrfToken = randomBytes(32).toString('hex');
  return req.session.csrfToken;
}

export function requireCsrf(req, _res, next) {
  const token = req.get('x-csrf-token');
  const expected = req.session.csrfToken;
  if (!token || !expected || token.length !== expected.length || !timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
    return next(new HttpError(403, 'CSRF_INVALID', 'Refresh the page and try again.'));
  }
  return next();
}
