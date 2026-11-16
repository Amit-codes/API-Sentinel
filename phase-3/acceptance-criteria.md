# Phase 3 acceptance checklist

Use a connected Node.js Express repository with JavaScript or TypeScript. A small disposable repository with a mounted router, controller, Jest test and Supertest request is ideal.

- [ ] Sign in and confirm the Phase 2 repository list still loads.
- [ ] Choose **Analyze repository** for a connected repository; analysis completes for its current selected-branch commit and displays the exact SHA.
- [ ] Project summary identifies package manager, package scripts, source/test counts, entry points, Jest configuration and Supertest usage when present.
- [ ] Direct Express `app`/`router` registrations for GET, POST, PUT, PATCH and DELETE are discovered with method and path.
- [ ] A mounted router's literal prefixes combine into the displayed full endpoint path.
- [ ] Route source file/line, middleware, handler and identifiable controller relationship appear for supported static registrations.
- [ ] Relative imports and identifiable controller-to-service/service-to-model relationships appear in the source relationships list.
- [ ] Jest test files, suites/cases and Supertest method/path requests are identified; statically matching requests map to discovered endpoints.
- [ ] An endpoint with no identifiable matching test is counted as unmapped; this does not claim test execution or coverage.
- [ ] Dynamic route/mount paths, parser diagnostics, missing tooling and bounded repository scans appear as uncertainty/coverage notes.
- [ ] Refreshing the page loads the saved latest analysis. Reanalyzing an unchanged commit reuses its analysis; a new branch commit produces a new commit-pinned analysis.
- [ ] A user cannot read or create analyses for another user's repository or analysis ID.
- [ ] Analysis data does not contain repository source contents, GitHub tokens or secrets.

Phase 3 does not compute changed-file impact, choose tests for execution, run repository code/tests, compare behavior baselines or classify regressions. Record failures here before proceeding to Phase 4.
