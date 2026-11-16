# Phase 4 acceptance checklist

Use a connected Express repository with at least two commits analyzed in Phase 3. Include one commit that changes a route/service and a test file.

- [ ] Phase 2 connection/branch settings and Phase 3 analysis still work.
- [ ] Impact Analysis lists connected repositories and saved analyses with exact commit SHAs.
- [ ] Comparing two different analyses calls GitHub for that exact base/head range and shows changed files, status and line counts.
- [ ] A changed route/controller file maps to the endpoint(s) reachable through the dependency graph.
- [ ] A changed service/model maps through reverse dependency edges to dependent controllers/routes where the static graph supports it.
- [ ] Related tests include test files mapped to affected endpoints; changed test files are included directly.
- [ ] New and removed endpoints are labelled when present in only one of the two analyzed commits.
- [ ] Partial scans, GitHub compare truncation, low-confidence endpoint mappings and missing test mappings are disclosed; the full suite is recommended when evidence is incomplete.
- [ ] One-analysis, same-commit, invalid analysis ID and cross-repository comparison attempts are rejected with safe errors.
- [ ] Comparing analyses from another user's repository is not possible.
- [ ] The impact report exposes paths and metadata only, never source contents or credentials.
- [ ] Impact analysis does not claim that tests have been selected, run or passed.

Record any failures here before moving to Phase 5. Phase 4 performs static impact mapping only; isolated test execution remains Phase 5.
