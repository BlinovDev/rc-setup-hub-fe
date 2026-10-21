# Frontend development

Use Node 24 from [.nvmrc](../.nvmrc), npm lockfile installs and strict TypeScript.
[README](../README.md) owns local setup; [testing](testing.md) owns check commands.
[Architecture](architecture.md) and [API](api.md) own state/transport boundaries.

- Focused feature components; page orchestration stays by routes. Share only real
  repeated responsibilities; no giant universal widgets or unnecessary dependencies.
- Avoid any except a justified external boundary. Generated transport types are
  authoritative; local view models are only for UI state. Never hand-edit generated code.
- Feature APIs/queries/mutations use the shared typed credentialed client; components
  do not scatter fetch. Never turn failures into empty data unless the contract says so.
- TanStack Query owns remote state, with stable scoped keys and cancellation before
  access-loss cache removal. No second server-state store or global invalidation.
- React Hook Form/Zod for substantial forms and UX validation. Preserve blank versus
  zero, numeric precision and full-data replacement; backend remains authoritative.
- React Router/URL owns bookmarkable filters and IDs; validate route/query input.
- Mobile-first styling and simple visual tokens; a component library needs concrete
  value, not decorative scope. [UI](ui.md) owns responsive/accessibility constraints.
- Public VITE_API_URL is controlled build-time config, never a secret channel. Do not
  hardcode production origins into application source. All VITE_* values are public.
- Safe status-specific feedback: 401 session; 400 validation; generic 404 missing or
  unavailable; 409 explicit conflict/reload; 500 retry. Do not invent undocumented
  endpoint statuses, expose server internals, render untrusted HTML or add open redirects.
- No auth/session tokens in frontend storage/state; no trusting hidden controls as
  security. React escapes user content. Keep media ephemeral and visibility-aware.
- Implement only approved criteria. Behavior changes need tests; docs change only
  by exception for enduring rules/contracts/commands, per [workflow](workflow.md).
  An ordinary fix/refactor may correctly make no evergreen-doc changes.

For application changes, formatter/lint/typecheck/tests/build and affected browser
checks must pass. Report evidence limits; green CI does not authorize merge/deploy.
