import { z } from 'zod';
import { readFileSync } from 'node:fs';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  API_BASE_URL: z.string().url().default('http://localhost:4000'),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  MONGODB_URI: z.string().min(1),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
  GITHUB_APP_ID: z.string().default(''),
  GITHUB_APP_SLUG: z.string().default(''),
  GITHUB_APP_PRIVATE_KEY: z.string().default(''),
  GITHUB_WEBHOOK_SECRET: z.string().default(''),
}).superRefine((values, context) => {
  const fields = ['GITHUB_APP_ID', 'GITHUB_APP_SLUG', 'GITHUB_APP_PRIVATE_KEY', 'GITHUB_WEBHOOK_SECRET'];
  const appConfiguredPartially = fields.some((field) => values[field].length > 0);
  if (appConfiguredPartially) {
    for (const field of fields) {
      if (!values[field]) context.addIssue({ code: 'custom', path: [field], message: 'Required when configuring the GitHub App' });
    }
  }
  if (values.GITHUB_APP_ID && !/^\d+$/.test(values.GITHUB_APP_ID)) {
    context.addIssue({ code: 'custom', path: ['GITHUB_APP_ID'], message: 'Must be a numeric GitHub App ID' });
  }
  if (values.GITHUB_APP_SLUG && !/^[a-z0-9-]+$/.test(values.GITHUB_APP_SLUG)) {
    context.addIssue({ code: 'custom', path: ['GITHUB_APP_SLUG'], message: 'Must be a lowercase GitHub App slug' });
  }
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map(({ path, message }) => `${path.join('.')}: ${message}`).join('\n');
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

function loadGitHubAppPrivateKey(value) {
  if (!value) return '';
  // Accept either PEM text or a path to a PEM file for local development.
  if (value.includes('-----BEGIN')) return value.replace(/\\n/g, '\n');
  try {
    return readFileSync(value, 'utf8').replace(/\r\n/g, '\n').trim();
  } catch {
    return value.replace(/\\n/g, '\n');
  }
}

export const env = Object.freeze({
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === 'production',
  isGitHubAppConfigured: Boolean(parsed.data.GITHUB_APP_ID && parsed.data.GITHUB_APP_SLUG && parsed.data.GITHUB_APP_PRIVATE_KEY && parsed.data.GITHUB_WEBHOOK_SECRET),
  githubCallbackUrl: `${parsed.data.API_BASE_URL.replace(/\/$/, '')}/api/v1/auth/github/callback`,
  githubAppPrivateKey: loadGitHubAppPrivateKey(parsed.data.GITHUB_APP_PRIVATE_KEY),
});
