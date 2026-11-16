# Phase 5 acceptance checklist

## GitHub setup

- [ ] `.github/workflows/api-sentinel.yml` from `workflow-template.yml` is committed to the connected repository's default branch.
- [ ] GitHub App has **Actions: Read and write**, and the installation has approved the updated permission.
- [ ] Target repository includes a lockfile and Jest or Vitest dependency; the saved head analysis reports the selected framework.

## Manual execution

- [ ] Save analyses for two distinct commits in the same connected repository.
- [ ] Compare them in Impact Analysis and select **Run full [framework] suite**.
- [ ] A run appears in Test Runs with the exact head SHA and a queued/in-progress/completed state.
- [ ] Refresh or wait for status polling; confirm the workflow URL opens the matching GitHub Actions run.
- [ ] Confirm the Actions checkout SHA matches the saved head analysis SHA.
- [ ] For a known passing Jest or Vitest suite, status becomes completed/success; for an assertion failure, status becomes failed and no automatic retry is created.
- [ ] Confirm the workflow runs with read-only contents permission and does not reference API Sentinel environment secrets.

## Safe failure paths

- [ ] Missing workflow or insufficient Actions permission produces a clear GitHub error and a persisted `dispatch_failed` run.
- [ ] An analysis without Jest or Vitest cannot start execution.
- [ ] Run listing and refresh cannot access another user's repository or run.
