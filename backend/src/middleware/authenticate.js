import { HttpError } from '../shared/HttpError.js';

export function requireAuthentication(req, _res, next) {
  if (!req.session.userId) return next(new HttpError(401, 'AUTH_REQUIRED', 'Sign in to continue.'));
  return next();
}
