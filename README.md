# API Sentinel

API Sentinel is a GitHub-integrated, change-aware API regression testing platform. The implementation follows the project plan phase by phase. The Phase 0 technical baseline is in [`phase-0/technical-specification.md`](phase-0/technical-specification.md).

## Current checkpoint: Phase 5 — Isolated full-suite execution

Phase 1 foundation: React/Vite dashboard shell, GitHub OAuth login with one-time state validation, server-side MongoDB sessions, CSRF-protected logout, Mongoose User model, Zod environment validation, Pino request logging, centralized errors and a MongoDB health check.

Phase 2 adds GitHub App installation linked to the signed-in session, installation-token issuance and in-memory expiry caching, authorized repository listing, repository selection and branch settings, disconnect, webhook signature verification and delivery deduplication. Installation tokens are never stored in MongoDB. Push events update the latest commit only for a connected repository's selected branch.

Phase 3 adds an on-demand exact-commit repository analyzer. It inspects bounded GitHub tree/blob data, package metadata, JavaScript/TypeScript ASTs, Express routes and mounts, static imports, route middleware/handler relationships, Jest/Vitest tests and statically identifiable Supertest request mappings. Results are scoped to the signed-in user and connected repository. Source contents and GitHub installation tokens are not persisted. Dynamic route/mount patterns and scan bounds are surfaced as warnings. It does not run repository code or tests; that remains Phase 5.

Phase 4 compares two saved Phase 3 analyses for the same connected repository, resolves their exact commit range with GitHub, maps changed files through the analyzed dependency graph to affected endpoints and related tests, and reports confidence and uncertainty. It does not run tests or claim test results. Use [`phase-4/acceptance-criteria.md`](phase-4/acceptance-criteria.md) for the manual Phase 4 check.

Phase 5 dispatches full Jest or Vitest suite runs to GitHub-hosted ephemeral runners, checks out the exact analyzed head commit, stores an owner-scoped execution record and refreshes its status from GitHub Actions. This first execution increment deliberately runs the full suite; selective execution and structured test result ingestion are not enabled yet. Repository code receives no API Sentinel database, OAuth or GitHub App credentials. See [`phase-5/technical-notes.md`](phase-5/technical-notes.md) and [`phase-5/acceptance-criteria.md`](phase-5/acceptance-criteria.md).

## Run locally

Requirements: Node.js 20.6+ with npm, and MongoDB running locally or an Atlas connection string.

1. Create a GitHub OAuth App for sign-in. Set its authorization callback URL to `http://localhost:4000/api/v1/auth/github/callback`.
2. Create a GitHub App with a setup URL of `http://localhost:4000/api/v1/github/app/setup`, webhook URL ending in `/api/v1/webhooks/github`, repository permissions **Metadata: Read-only**, **Contents: Read-only**, and **Actions: Read and write**. Subscribe to **Push**, **Installation**, and **Installation repositories** events. Note the App ID and URL slug, generate a private key, and create a webhook secret. For local webhook delivery, configure the App's webhook URL to an HTTPS forwarder/tunnel that sends deliveries to `http://localhost:4000/api/v1/webhooks/github`; keep the configured webhook secret the same.
3. Copy `.env.example` to `.env`. Set the OAuth client ID/secret and a random `SESSION_SECRET` of at least 32 characters. GitHub App fields may stay blank while you test sign-in only; repository and webhook endpoints will return a clear configuration error until all four App fields are set. For the private key, set `GITHUB_APP_PRIVATE_KEY` to either the PEM text as a quoted value with literal `\n` line breaks or to the local path of the downloaded PEM file. Set `MONGODB_URI` if your MongoDB URI differs from the local default. Do not commit `.env`.
4. In one terminal, from `backend/`, run `npm install` and `npm run dev`.
5. In another terminal, from `frontend/`, run `npm install` and `npm run dev`.
6. Open `http://localhost:5173`, sign in with GitHub, select **Repositories**, install the GitHub App, browse its authorized repositories, connect one, and change its monitored branch. Check `http://localhost:4000/api/v1/health` for database status.

Use [`phase-2/acceptance-criteria.md`](phase-2/acceptance-criteria.md) for the manual Phase 2 check. The earlier Phase 1 checklist remains in [`phase-1/acceptance-criteria.md`](phase-1/acceptance-criteria.md).

Use [`phase-3/acceptance-criteria.md`](phase-3/acceptance-criteria.md) for the manual Phase 3 check. From **Repositories**, choose **Analyze repository** on a connected repository to inspect the latest selected-branch commit.

For Phase 4, save analyses for two different commits, then open **Impact Analysis**, choose the repository and commits, and select **Compare commits**. See [`phase-4/technical-notes.md`](phase-4/technical-notes.md) for the API and bounds.

For Phase 5, add [`phase-5/workflow-template.yml`](phase-5/workflow-template.yml) to the connected repository as `.github/workflows/api-sentinel.yml` on its default branch, then update the GitHub App's Actions permission and approve the updated access for the installation. The repository needs `package-lock.json` and Jest or Vitest installed; set `scripts.test` when both are present. Analyze two different commits, compare them in **Impact Analysis**, and start the full test suite. Track the status under **Test Runs**. See the Phase 5 acceptance checklist before trying a real run.

The API defaults to port 4000 and Vite to 5173. For a different frontend/API origin, configure `WEB_ORIGIN`, `API_BASE_URL` and optionally `VITE_API_BASE_URL` (the frontend build-time API origin). Point the GitHub App's webhook setting at your reachable webhook endpoint or local forwarder. Use HTTPS and secure cookies in production. Do not expose OAuth client secrets, the App private key or webhook secret in frontend configuration.

## Project layout

- `backend/src/modules/` — business modules, routes, controllers and services.
- `backend/src/database/` — MongoDB connection and Mongoose models.
- `frontend/src/` — React application shell and API client.
- `phase-0/` — initial contracts, requirements and security boundaries.
- `phase-2/` — Phase 2 technical notes and local acceptance checklist.
