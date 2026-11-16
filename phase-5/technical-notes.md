# Phase 5 technical notes — isolated execution

## Current increment

The API creates an owner and repository scoped `ExecutionRun`, pins the chosen head analysis SHA and commit ref, captures the runner commands/runtime, package directory and detected Jest/Vitest framework, then dispatches `.github/workflows/api-sentinel.yml` through the GitHub App installation token. The token stays in the API process. The repository workflow checks out the exact SHA with checkout credentials disabled, installs from the lockfile, and runs the selected test framework from the analyzed package directory on an ephemeral GitHub-hosted runner. The workflow has read-only contents permission and a 20 minute job timeout.

The frontend only starts a run from two saved, different analyses and the backend verifies both belong to the connected repository and signed-in owner. Only analyses where Jest or Vitest was detected can run. If both are installed, the `scripts.test` command must identify the selected framework. Execution status is refreshed from the matching GitHub Actions workflow run. GitHub Actions URL links users to detailed runner logs.

This increment intentionally runs the full Jest or Vitest suite every time. Impact-based selection, result/coverage artifact ingestion, approval policy, quotas, retry orchestration, and execution command editing remain future work. A failing test suite is recorded as a failed run; it is not retried as infrastructure failure. The workflow does not receive API Sentinel secrets. Since test scripts execute repository code, they can access the checked-out repository and the runner's public network environment; use a dedicated repository with trusted code.

## Setup

1. Add `workflow-template.yml` to the target repository at `.github/workflows/api-sentinel.yml` on its default branch.
2. Configure the GitHub App repository permission **Actions: Read and write**, then approve the updated permission for the installation. Existing installations do not automatically grant newly requested permissions.
3. Ensure the repository has `package-lock.json` and Jest or Vitest as a project dependency. If both are present, make `scripts.test` select the intended runner.
4. Analyze the base and head commits, open Impact Analysis, compare them, and start a full-suite run. Open Test Runs to refresh status.

The workflow dispatches on the repository default branch (where the workflow file is installed), but its checkout step uses the head analysis's exact commit SHA. Inputs contain only the internal run identifier and commit SHA. The Actions workflow uses `contents: read`; checkout does not persist credentials for subsequent steps.

## API

- `POST /api/v1/repositories/:id/runs` — CSRF protected; body `{ "baseAnalysisId": "...", "headAnalysisId": "..." }`; responds `202` with a persisted run.
- `GET /api/v1/repositories/:id/runs` — lists the latest 50 runs for the authenticated owner/repository.
- `POST /api/v1/repositories/:id/runs/:runId/refresh` — CSRF protected status refresh against GitHub Actions.

Stored status is `dispatching`, `queued`, `in_progress`, `completed`, `failed`, `cancelled`, or `dispatch_failed`. No execution logs, source files, test output or artifacts are copied into API Sentinel in this increment.
