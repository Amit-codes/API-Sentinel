# Phase 3 implementation notes

The analyzer reads the selected branch's current commit through the installed GitHub App, resolves and records its immutable commit SHA, then fetches the recursive Git tree and bounded JavaScript/TypeScript/package metadata blobs. It does not clone or execute repository code. It caps inspection at 400 eligible files and 8 MiB of declared file sizes, skips individual files larger than 512 KiB, and marks bounded scans partial.

The TypeScript Compiler API parses JavaScript, JSX, TypeScript and TSX. Static Express `app`/`router` HTTP registrations and `.route(...).method(...)` calls are collected; router mounts and literal prefixes are combined. Import edges, common controller/service/model layer edges, route middleware/handler/controller relationships, local function calls, Jest test names, Supertest requests and exact method/path test mappings are persisted. Computed paths, parser diagnostics, missing test tooling and bounded scans appear as analyzer warnings. A test association means the source contains a matching static request; it does not claim the test passed or was executed.

MongoDB collections: `Analysis`, `Endpoint`, `SourceFile`, `Dependency`, `TestFile` and `TestEndpointMapping`. Records include the owner and repository IDs. Source contents, OAuth credentials, App private keys and installation tokens are not persisted in analysis records.

Authenticated APIs:

| Method/path | Contract |
|---|---|
| POST `/api/v1/repositories/:id/analyses` | CSRF protected; analyze the connected repository's selected branch at the exact commit resolved by GitHub; reuse a completed analysis for the same commit |
| GET `/api/v1/repositories/:id/analyses/latest` | Return latest completed/partial analysis details, scoped to the signed-in owner |
| GET `/api/v1/repositories/:id/analyses` | Return up to 20 analysis summaries for the connected repository |
| GET `/api/v1/repositories/:id/analyses/:analysisId` | Return one analysis only when it belongs to the signed-in owner and repository |

Analysis remains on-demand in Phase 3. Push-triggered analysis, commit-diff impact mapping, test execution, behavioral baselines and regression conclusions are later phases.
