# Bootstrap status

FE Phase 0 is complete and technically accepted. The application bootstrap, testing
stack, OpenAPI generation and typed API client are implemented. See `README.md`
for install, run and verification commands.

Continue one roadmap phase at a time using `AI/roadmap.md`. FE Phase 1 is complete,
including manually verified live backend/browser smoke: Google login through the
backend, callback redirect to the frontend, authenticated `/api/v1/me`, and Sign out
returning the UI to Sign in without a page reload.

FE Phase 2 implementation and automated verification are complete. Live `/settings`
nickname-edit smoke remains pending. Chassis selector automated tests suffice for
Phase 2 implementation review; no standalone live selector smoke is required
because it is intentionally not mounted into a product route until Phase 3.
FE Phase 3 is not started.

Do not start the next phase until the current phase is reviewed, committed, pushed
and its checkpoint is green.

Do not ask Codex to build the whole application in a single prompt.
