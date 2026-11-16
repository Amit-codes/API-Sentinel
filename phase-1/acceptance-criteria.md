# Phase 1 acceptance checklist

Run the app locally using the steps in the repository README, then verify each item in the browser:

- [ ] Opening the web app shows the GitHub sign-in screen.
- [ ] Starting login redirects to GitHub and returns to the configured callback.
- [ ] A successful login lands on the dashboard with the GitHub profile shown.
- [ ] Refreshing the dashboard retains the signed-in profile.
- [ ] Calling `/api/v1/users/me` while signed out returns `401`.
- [ ] Signing out from the account menu returns to the sign-in screen; refreshing does not restore the session.
- [ ] `/api/v1/health` returns `200` with MongoDB connected; when MongoDB is down it returns `503`.
- [ ] The dashboard clearly labels repository connection and analysis as future phases; no fabricated repository or analysis results appear.

Record any failed item before treating Phase 1 as complete. Phase 2 implementation does not replace or change these checks.
