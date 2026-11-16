# Phase 2 acceptance checklist

Configure a GitHub App and run the app locally using the repository README. Use a disposable repository if possible.

- [ ] Phase 1 login, refresh persistence and logout still work.
- [ ] Starting App installation while signed in sends the browser to the configured GitHub App.
- [ ] Completing installation returns to the same signed-in API Sentinel account and shows the installation account.
- [ ] The available-repository list contains only repositories granted to that App installation.
- [ ] Selecting an authorized repository connects it with its actual name, visibility and default branch.
- [ ] Selecting another existing branch updates the monitored branch and it remains selected after refresh.
- [ ] Selecting a repository or installation ID outside the signed-in user's installation returns `404` and does not create a connection.
- [ ] Disconnecting removes it from connected repositories; reconnecting it restores the connected status.
- [ ] A webhook with an incorrect signature returns `401` and creates no event.
- [ ] A valid push webhook is persisted once, repeated delivery IDs are deduplicated, and the selected branch's latest commit SHA is displayed.
- [ ] A push to another branch is accepted and recorded as ignored without changing the monitored branch's last-push SHA.
- [ ] Removing or suspending the App updates the installation/connection state.
- [ ] OAuth credentials, App private key, webhook secret, session ID and installation access tokens do not appear in API responses, browser storage, or logs; installation tokens are not persisted in MongoDB.

Phase 2 does not analyze repository source or run tests. Those are Phase 3 and Phase 5. Record any failed item here before proceeding.
