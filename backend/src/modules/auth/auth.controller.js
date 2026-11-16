import { env } from '../../config/env.js';
import { HttpError } from '../../shared/HttpError.js';
import { ZodError } from 'zod';
import { callbackQuerySchema } from './auth.validation.js';
import { buildGitHubAuthorizationUrl, createOAuthState, isValidOAuthState, signInWithGitHub, toPublicUser } from './auth.service.js';

export function startGitHubLogin(req, res) {
  const state = createOAuthState();
  req.session.oauthState = state;
  req.session.save((error) => {
    if (error) return res.status(500).json({ error: { code: 'SESSION_ERROR', message: 'Sign-in could not be started.', requestId: req.id } });
    return res.redirect(buildGitHubAuthorizationUrl(state));
  });
}

export async function finishGitHubLogin(req, res, next) {
  try {
    const { code, state } = callbackQuerySchema.parse(req.query);
    const expectedState = req.session.oauthState;
    delete req.session.oauthState;
    if (!isValidOAuthState(state, expectedState)) throw new HttpError(400, 'OAUTH_STATE_INVALID', 'The sign-in request expired. Please try again.');
    const user = await signInWithGitHub(code);
    await new Promise((resolve, reject) => req.session.regenerate((error) => error ? reject(error) : resolve()));
    req.session.userId = String(user._id);
    await new Promise((resolve, reject) => req.session.save((error) => error ? reject(error) : resolve()));
    return res.redirect(env.WEB_ORIGIN);
  } catch (error) {
    if (error instanceof ZodError || error.status === 400 || error.status === 502) {
      return res.redirect(`${env.WEB_ORIGIN}/?error=oauth_failed`);
    }
    return next(error);
  }
}

export async function logout(req, res, next) {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie('api-sentinel.sid', { httpOnly: true, sameSite: 'lax', secure: env.isProduction, path: '/' });
    return res.status(204).end();
  });
}
