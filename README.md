# RC Setup Hub Frontend

User-facing web client for RC Setup Hub.

This repository is intentionally separate from the Go backend.

Preferred local location:

```text
/Users/anton/Programming/React/rc-setup-hub-fe
```

Backend repository:

```text
https://github.com/BlinovDev/rc-setup-hub
```

Frontend repository:

```text
https://github.com/BlinovDev/rc-setup-hub-fe
```

## Current repository state

FE Phases 0–2 are complete, including live authentication and `/settings`
nickname-edit smoke against the real local backend. Phase 3 implementation and
automated verification are complete; live owned-setup CRUD smoke remains pending.
Phase 4 is not started.

Authenticated routes include `/`, `/settings`, `/my/setups`, `/my/setups/new`,
and `/my/setups/:setupId/edit`. The root remains the minimal auth shell; public
search and `/setups/:setupId` detail/share routes are deferred to Phase 4.

## Stack

- React
- TypeScript
- Vite
- React Router
- TanStack Query
- React Hook Form
- Zod
- Vitest
- React Testing Library
- MSW
- Playwright later for end-to-end flows

A large global state manager is intentionally not part of the initial stack.

## Backend assumptions

Local development is expected to use:

```text
Frontend: http://localhost:5173
Backend:  http://localhost:8080
```

The frontend uses backend-owned Google authentication and an HttpOnly application session cookie.

The current backend contract is committed at `api/openapi.yaml`, including login
redirect and CORS/cookie guidance. See `AI/api.md`.

## Install and run

Use Node.js 24 LTS (`.nvmrc`) and npm:

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Vite serves the frontend at `http://localhost:5173` with a strict port. The only
environment variable is `VITE_API_URL=http://localhost:8080`.
The config helper defaults to that local origin and rejects non-HTTP(S) URLs,
embedded credentials, paths, queries and fragments. All `VITE_*` values are public
build-time configuration; never put secrets in them. Local env files are ignored.

The foundation uses React, TypeScript, Vite, React Router, TanStack Query and
Tailwind CSS. React Hook Form and Zod power nickname editing. Vitest,
React Testing Library, user-event, jest-dom, jsdom and MSW provide tests. ESLint
and Prettier provide linting and formatting. Exact dependency versions and the npm
lockfile make installs reproducible. TypeScript 5.9 satisfies openapi-typescript's
TypeScript 5 peer requirement.

```text
src/
  app/                 App, providers, router and shell tests
  api/                 config, typed client and HTTP-boundary tests
    generated/schema.ts
  features/            auth, profile, chassis, setups, search, friendships, users
  shared/              components, hooks, utils (empty placeholders)
  test/                MSW server and shared test setup
  main.tsx
  styles.css
  vite-env.d.ts
```

Auth, profile, chassis and owned setup features are implemented; other feature/shared directories contain only
placeholders until their roadmap phases. The QueryClient is created once per
provider instance. The root shell resolves the session with `GET /api/v1/me`.

### OpenAPI workflow and API client

```bash
npm run api:generate
```

This runs `openapi-typescript api/openapi.yaml -o src/api/generated/schema.ts`.
Commit the generated file with contract changes; never edit it manually. Generated
files are excluded from lint/format rewrites. The OpenAPI source is preserved.
Generation and the generic client foundation were completed in Phase 0. Phase 1
uses them for current-user queries, authentication state, Google login browser
navigation, logout, session-expired behavior and loading/error states.

`src/api/client.ts` uses `openapi-fetch` parameterized with generated `paths`, so
endpoint methods, parameters, request bodies and response bodies come from the
contract. It uses the origin from `src/api/config.ts`. Credentials default to
`include`, and the final fetch wrapper forces `include` even when a caller tries
to override it. No tokens are stored or read. Future feature query/mutation modules
should consume this client. HTTP errors remain available as typed `error` plus
`response.status`; network failures reject. Feature modules must handle these
deliberately rather than turn failures into empty data. OAuth routes require browser
navigation, as the contract specifies, rather than this fetch client.

### Authentication foundation

`src/features/auth/` contains API functions, query/mutation configuration, the auth
shell, login action and browser-navigation boundary. Current-user state uses the
query key `["auth", "me"]`, a one-minute freshness window, no polling and no
automatic retries. Stale queries recheck on window focus/reconnection. Explicit
Retry handles server/network failures without treating them as signed-out sessions.
See [TanStack Query focus behavior](https://tanstack.com/query/latest/docs/framework/react/guides/window-focus-refetching).

A `/me` 401 replaces cached user data with `null`, removing stale nickname/avatar
and showing sign-in. Clicking sign-in uses `window.location.assign` to navigate to
`{VITE_API_URL}/auth/google`. The backend handles OAuth and redirects to its trusted
`APP_URL`; React only resolves the session afterward.

Logout posts through the existing typed client. Only a 204 clears current-user
state, after cancelling any older in-flight `/me` request. No reload or broad cache
invalidation is required. Failures preserve authenticated state and offer retry.
Pending logout disables the action. Authentication uses no browser storage, tokens,
persistence or frontend OAuth callback handling.

Phase 1 live backend/browser smoke was manually verified at
`http://localhost:5173` with the real local backend: Google login navigated through
backend OAuth, the callback redirected back to the frontend, `/api/v1/me` returned
the authenticated user, and Sign out changed the UI back to Sign in without a page
reload. Automated tests use MSW and do not perform real Google OAuth.

### Profile and active chassis catalog

`/settings` uses the same auth gate/current-user query as `/`. Authenticated users
see avatar, nickname, email and the existing logout control, with Home/Settings
navigation. A session 401 removes the settings form and profile data.

The React Hook Form nickname form trims whitespace, rejects empty names, names
longer than 64 Unicode characters and null characters. Unchanged normalized names
are not submitted. Zod validates these UX rules; uniqueness remains backend-owned.
The PATCH uses generated `PatchMe` types. Success updates only `["auth", "me"]`
with the returned user and resets the form. Errors map statuses to safe feedback;
PATCH 401 clears current-user state. No full-page reload is required.

`src/features/chassis/` provides generated-type API/query functions and a controlled
`ChassisSelector`, now reused by Phase 3 setup forms. It does not persist a profile
preference. Query keys are `["chassis", "brands"]` and
`["chassis", "models", brandId]`, cached for five minutes without polling or
automatic retries. Models are only fetched for a real brand; brand changes clear
the selected model immediately. Loading, error/retry and empty states are explicit;
a models 404 displays an unavailable-brand message rather than an empty list.

Selection state is `{ brandId: string | null, modelId: string | null }`.
`selectedChassisModelId` returns `null` for Custom, a model ID for a complete
selection, and `undefined` for an incomplete brand selection. The setup form
requires a model for a selected brand before saving. No fake Custom UUID is used.

Phase 2 is complete, including manually verified live `/settings` nickname editing.
Chassis selector automated tests verified the reusable component before it was
integrated into Phase 3; no standalone live selector route was required.

### Owned setup CRUD

`src/features/setups/` contains API functions, query/mutation hooks, list/create/edit
pages, inline delete confirmation, and a setup-specific React Hook Form. Form
sections cover General, front/rear suspension and link arrays, front/rear shocks
and springs, and electronics. Zod provides UX validation; the backend remains
authoritative. Inputs have accessible labels and work on small screens.

`setupToForm` maps the generated `Setup` into explicit input strings. Optional
numbers use empty strings; numeric zero becomes `"0"`. `parseOptionalNumber`
converts blank to omitted and `"0"` to numeric zero, rejecting non-finite values.
Oil and link lengths must be positive. Serialization trims technical text, prunes
empty nested sections and arrays, and permits an empty `data: {}` document. Empty
notes become `null`, including when clearing previously saved notes.

Create sends the required title/visibility/data, notes and Custom/null or an active
model ID. A selected brand without a model blocks submission. Successful creation
returns to My setups with confirmation. Edit sends the complete technical document
because PATCH replaces `data` rather than deep-merging. Owner/schema/chassis display
metadata are never sent. Unsupported schema versions and non-owner edit results
show safe states without editable controls.

Historical chassis display comes from `setup.chassis`, never the active catalog.
Edit initially keeps the current reference and omits `chassis_model_id` from PATCH.
Only Change chassis opens the active selector. It can send an active ID or explicit
Custom/null; Cancel chassis change returns to keeping the current reference.

Query keys are `["setups", "mine"]` and `["setups", "detail", id]`. Create invalidates
only the owned list. Update replaces the affected detail cache and invalidates the
owned list. Delete requires confirmation, removes affected detail/list data and
refetches the owned list; deletion from edit returns to My setups. Automatic retries
are disabled. A setup 401 clears the existing current-user cache and protected UI;
other failures show safe feedback. PATCH 409 keeps the form and requires explicit
Reload setup, labeled as discarding unsaved changes, before another save.

Phase 3 live smoke is pending: create a realistic setup with zero and blank angles,
verify the owned list, reopen/edit it while retaining other technical fields, clear
notes, exercise chassis change/cancel, and confirm deletion against the local backend.

### Verification

```bash
npm run api:generate
npm run format:check
npm run lint
npm run typecheck
npm test -- --run
npm run build
```

Use `npm run format` to format maintained files. Existing instruction documents and
the backend contract are excluded to preserve them. MSW treats unhandled requests
as errors and resets handlers after each test. Playwright remains deferred.

### Contract review for later phases

No contract issue blocks the bootstrap. The contract includes the direct public
profile endpoint and historical chassis display. All `/api/v1` endpoints, including public discovery, require a session.
Numeric/UUID/length constraints require runtime form validation later; generated
TypeScript types do not validate values at runtime.

The contract does not list `415` for setup create/patch responses despite JSON
request bodies, while profile and friendship writes do. Unexpected setup statuses
use generic safe feedback; no undocumented status behavior is assumed. The documented 256 KiB body limit also has no explicit oversized-body
response status. No status or backend behavior is assumed here. CORS requires the
frontend origin in backend `ALLOWED_ORIGINS`; frontend code cannot configure that.
