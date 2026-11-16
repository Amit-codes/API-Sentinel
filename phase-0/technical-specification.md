# API Sentinel technical specification (Phase 0)

Status: implementation baseline for the local Phase 1 checkpoint. Later phases extend these contracts; they do not authorize pretending future integrations already work.

## Requirements and boundaries

API Sentinel is a public developer product. A developer signs in with GitHub, connects repositories they are authorized to access, and eventually receives explainable, change-aware API regression results. Initial source ecosystem: Node.js, Express, JavaScript/TypeScript, Jest and Supertest. Source analysis will use the TypeScript Compiler API and runtime coverage. GitHub Actions is the isolated execution environment. MongoDB/Mongoose persist application data. The backend is a modular monolith; the frontend is React/Vite.

Phase 1 delivers a running application shell, GitHub OAuth login, persisted server-side sessions, user profile, logout and health endpoint. Repository connection, webhooks, source analysis, test execution and regression detection are explicitly later phases. No sample result may be presented as real analysis.

## Non-functional requirements and security boundary

- Validate configuration and request inputs; use structured Pino logs and centralized safe error responses.
- OAuth uses a one-time, session-bound, cryptographically random `state`; compare in constant time and consume it once. Never put provider tokens in browser storage or expose them to the frontend.
- Sessions are server-side in MongoDB, `httpOnly`, `sameSite=lax`, and `secure` in production; rotate the session ID after login and destroy it on logout.
- In production, require HTTPS and a same-origin frontend/API deployment or configure an explicit trusted origin. Mutating browser requests use a session-bound CSRF token; OAuth callbacks are protected by `state`.
- Every future repository read/write is scoped to the authenticated owner/installation. Webhooks require signature verification and deduplication. Repository code runs only on ephemeral GitHub-hosted Actions runners; platform credentials are never passed to it.
- Apply rate limits, execution timeouts, quotas, bounded artifacts/logs, audit logging and retention controls before public execution is enabled. Phase 1 has no execution feature.
- Do not log OAuth codes, tokens, session IDs, secrets or request cookies. Health reports dependency status, not credentials or stack traces.

## Module boundaries

`backend/src/modules/auth` owns GitHub OAuth, login/logout/current-user and auth validation. `config` validates environment; `database` owns Mongoose connection and models; `middleware` owns authentication, CSRF, request IDs and errors; `shared` owns common response/error helpers. Future modules own GitHub App/repositories, webhooks, analyzer, impact mapping, test selection, execution, baselines/regressions, failure analysis, reports and notifications. A module calls another module through its exported service, not its private data-access files. Route handlers delegate to controllers/services.

## Phase 1 REST contract

All endpoints use `/api/v1`, JSON, credentials included, and `{ data: ... }` success envelopes. Errors use `{ error: { code, message, requestId } }`; never return internal stack traces.

| Method/path | Auth | Contract |
|---|---|---|
| GET `/api/v1/health` | No | `200 { data: { status: "ok", database: "connected" } }`; `503` if Mongo is unavailable |
| GET `/api/v1/auth/github` | No | Creates OAuth state in the server session and redirects to GitHub |
| GET `/api/v1/auth/github/callback?code&state` | OAuth state | Validates and consumes state, exchanges code server-side, upserts User, rotates session, redirects to frontend |
| GET `/api/v1/auth/csrf` | Session | `200 { data: { csrfToken } }`, session-bound token for same-origin mutating requests |
| GET `/api/v1/users/me` | Yes | `200 { data: { user: { id, githubId, username, displayName, avatarUrl } } }` |
| POST `/api/v1/auth/logout` | Yes + CSRF | Destroys server session and clears cookie; `204` |

Unauthenticated protected requests return `401 AUTH_REQUIRED`. Invalid/expired OAuth state returns `400 OAUTH_STATE_INVALID`; provider failures return a safe `502 OAUTH_PROVIDER_ERROR`. Validation errors return `400 VALIDATION_ERROR`. Rate-limit auth endpoints. API versioning, authorization and response envelopes apply to later modules too.

## Initial persistence design

`User`: unique immutable GitHub numeric ID; username; nullable display name/avatar; timestamps. Never persist access tokens in Phase 1 because profile login does not need them after fetching the profile. `Session`: opaque session ID, serialized server-side data, expiry; MongoStore owns this collection with a TTL index and does not duplicate its ownership through a Mongoose model. This is the explicit implementation of the planned User and Session models while avoiding two competing session stores.

Future collections: githubInstallations, repositories, analyses, endpoints, sourceFiles, dependencies, testFiles, testEndpointMappings, webhookEvents, executionJobs, testExecutions, coverageRecords, baselines, baselineVersions, regressions, failureGroups, notifications. Every record will be repository/owner scoped, executions pin an exact SHA/configuration, and large artifacts use bounded external storage.

## GitHub OAuth and GitHub App

Phase 1 uses a GitHub OAuth App (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`) with callback `${API_BASE_URL}/api/v1/auth/github/callback` and minimum `read:user` scope. OAuth is login only. Phase 2 introduces a separately configured GitHub App for repository access and push webhooks, installation tokens and permission review; OAuth user identity is not treated as repository authorization. Webhook secret is separate from either OAuth secret or installation private key.

## Execution contract (future Phase 5)

Job states: `CREATED -> ANALYZING -> AWAITING_APPROVAL | QUEUED -> RUNNING -> COLLECTING_RESULTS -> COMPLETED`; terminal alternatives include `FAILED`, `CANCELLED`, `TIMED_OUT`. Persist exact commit SHA and captured repository configuration. MongoDB atomic claims and leases provide initial coordination. Dispatch an Actions workflow on an ephemeral hosted runner, checkout the exact SHA, install/configure, run selected Jest tests, collect coverage/structured results and bounded artifacts. Never pass API Sentinel DB credentials, installation tokens or OAuth credentials to repository scripts. Retry transient infrastructure failures only, never assertion failures; preserve SHA/config on retry. Low confidence means full suite, never silent skipping.

## Supported source patterns and result classifications

Phase 3 starts with Express `app`/`router` HTTP method registrations, mounted routers/prefixes, middleware and identifiable controller relationships; dynamic patterns are explicitly reported as unsupported/uncertain. Parse JavaScript/TypeScript ASTs, not regex alone. Distinguish test assertion failure, startup, DB setup, dependency, timeout, infrastructure and detected behavior regression. A test failure alone is not a regression. Regression stages: status, response schema, normalized body, then latency only with enough comparable observations. Baselines require developer approval and retain versions.

## Phase gates

Phase 0: interfaces and security boundaries documented (this document and `phase-0/acceptance-criteria.md`). Phase 1: developer can GitHub-login, reach dashboard, refresh with session intact and securely log out. Subsequent phases must pass their own acceptance criteria and local integration before beginning the next. No performance claims without evaluation against controlled Express repositories and injected bugs.
