# Bootstrap status

FE Phase 0 is complete and technically accepted. The application bootstrap, testing
stack, OpenAPI generation and typed API client are implemented. See `README.md`
for install, run and verification commands.

Continue one roadmap phase at a time using `AI/roadmap.md`. FE Phase 1 is complete,
including manually verified live backend/browser smoke: Google login through the
backend, callback redirect to the frontend, authenticated `/api/v1/me`, and Sign out
returning the UI to Sign in without a page reload.

FE Phase 2 is complete, including manually verified live `/settings` nickname-edit
smoke. Chassis selector automated tests were sufficient for Phase 2 review; it is
now reused in Phase 3 setup forms.

FE Phase 3 is complete, including manually verified live owned CRUD smoke.

FE Phase 4 implementation and automated verification are complete. Live discovery/
share smoke is pending. FE Phase 5 is not started; full user-profile routes remain
Phase 6.

Do not start the next phase until the current phase is reviewed, committed, pushed
and its checkpoint is green.

Do not ask Codex to build the whole application in a single prompt.
