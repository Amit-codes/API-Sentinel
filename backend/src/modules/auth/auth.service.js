import { randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '../../config/env.js';
import { User } from '../../database/models/User.js';
import { HttpError } from '../../shared/HttpError.js';

const githubHeaders = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };

export function createOAuthState() {
  return randomBytes(32).toString('hex');
}

export function isValidOAuthState(received, expected) {
  if (typeof received !== 'string' || typeof expected !== 'string' || received.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

export function buildGitHubAuthorizationUrl(state) {
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  url.searchParams.set('redirect_uri', env.githubCallbackUrl);
  url.searchParams.set('scope', 'read:user');
  url.searchParams.set('state', state);
  return url.toString();
}

async function requestGitHub(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new HttpError(502, 'OAUTH_PROVIDER_ERROR', 'GitHub sign-in could not be completed. Please try again.');
  return response.json();
}

export async function signInWithGitHub(code) {
  const tokenData = await requestGitHub('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { ...githubHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code }),
  });
  if (!tokenData.access_token) throw new HttpError(502, 'OAUTH_PROVIDER_ERROR', 'GitHub sign-in could not be completed. Please try again.');

  const profile = await requestGitHub('https://api.github.com/user', {
    headers: { ...githubHeaders, Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'API-Sentinel' },
  });
  if (!profile.id || !profile.login) throw new HttpError(502, 'OAUTH_PROVIDER_ERROR', 'GitHub returned an incomplete profile.');

  return User.findOneAndUpdate(
    { githubId: String(profile.id) },
    { $set: { username: profile.login, displayName: profile.name || null, avatarUrl: profile.avatar_url || null } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
}

export function toPublicUser(user) {
  return { id: String(user._id), githubId: user.githubId, username: user.username, displayName: user.displayName, avatarUrl: user.avatarUrl };
}
