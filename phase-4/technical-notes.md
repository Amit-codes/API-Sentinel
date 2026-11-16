# Phase 4 implementation notes

Phase 4 compares two persisted, exact-SHA Phase 3 analyses from the same connected repository. It uses GitHub's compare API to obtain changed paths and line counts, then traverses the union of both analyses' dependency graphs from changed files toward dependents. Reached route/controller files map to discovered endpoints. Existing endpoint-to-test mappings identify candidate tests; changed test files are included directly and can also mark their mapped endpoints as affected. Mapping confidence includes the endpoint and dependency-edge confidence.

The impact report is computed on demand and is not persisted. It contains commit identities, changed path metadata, endpoint/test paths, evidence, confidence and bounded-scan warnings. It does not contain source contents, installation tokens or test results, and it never runs repository code. If evidence is partial/low, changed runtime source files cannot be traced, an affected endpoint has no mapped test, or there are no mapped tests, the response recommends running the full suite rather than skipping tests.

Authenticated API:

| Method/path | Contract |
|---|---|
| POST `/api/v1/repositories/:id/impact` | Session + CSRF protected; body `{ "baseAnalysisId": "...", "headAnalysisId": "..." }`; both analyses must belong to the signed-in user and connected repository. GitHub verifies the exact commit range before the report is returned. |

The repository must remain connected and its GitHub App installation active. GitHub's compare endpoint currently returns at most 300 changed files; that bound is surfaced as a warning and reduces confidence. Both commits must already have saved Phase 3 analyses. Impact mappings are candidates, not test selection or execution; execution is Phase 5.
