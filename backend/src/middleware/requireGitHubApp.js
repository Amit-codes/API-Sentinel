import { env } from '../config/env.js';
import { HttpError } from '../shared/HttpError.js';

export function requireGitHubApp(_req, _res, next) {
  if (!env.isGitHubAppConfigured) {
    return next(new HttpError(503, 'GITHUB_APP_NOT_CONFIGURED', 'GitHub App credentials are not configured yet. Add the App settings to the local .env file to connect repositories.'));
  }
  return next();
}
