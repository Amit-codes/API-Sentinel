# Phase 2 implementation contract

The local implementation adds these authenticated APIs:

| Method/path | Contract |
|---|---|
| GET `/api/v1/github/app/install` | Creates a random session-bound setup state and redirects to the GitHub App installation page |
| GET `/api/v1/github/app/setup` | Validates setup state, verifies installation details with an App JWT, associates the installation with the signed-in user and redirects back |
| GET `/api/v1/github/installations` | Lists only active App installations owned by the signed-in user |
| GET `/api/v1/github/installations/:installationId/repositories` | Returns only repos granted to that owned installation |
| GET `/api/v1/repositories` | Lists only connected repositories owned by the signed-in user |
| POST `/api/v1/repositories` | CSRF-protected; verifies installation ownership, repository membership and branch before connecting |
| GET `/api/v1/repositories/:id/branches` | Lists branches only for an owned, connected repository |
| PATCH `/api/v1/repositories/:id/branch` | CSRF-protected; verifies the branch with GitHub before updating |
| DELETE `/api/v1/repositories/:id` | CSRF-protected soft-disconnect |
| POST `/api/v1/webhooks/github` | Verifies raw-body HMAC-SHA256, claims delivery ID idempotently, processes configured installation and push events |

GitHub App JWTs are signed in process from the private-key environment variable. Short-lived installation tokens are cached only in process memory until shortly before expiry. Persisted records contain installation/repository metadata, never provider tokens. Webhook events have a unique delivery ID, processing state and retry claim for failed/stale processing. Push events update SHA/time only when the pushed ref matches that connected repository's selected branch. Analysis is deliberately deferred to Phase 3.
