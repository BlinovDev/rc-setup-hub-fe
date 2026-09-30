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

FE Phases 0 and 1 are implemented. The bootstrap includes an authentication-aware
root route and a not-found route. The shell checks the backend session, offers
Google sign-in, displays the current nickname/avatar, and supports logout. Product
features remain deferred to FE Phase 2 and later in `AI/roadmap.md`.
The live backend-session checkpoint still requires a locally signed-in backend.

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
Tailwind CSS. React Hook Form and Zod are installed for later forms. Vitest,
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

The auth feature is implemented; other feature/shared directories contain only
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

For the live checkpoint, configure the backend's `ALLOWED_ORIGINS` for
`http://localhost:5173` and `APP_URL` for the frontend root. Start both servers,
click sign-in, and verify nickname/avatar after the backend redirects back. Verify
logout replaces the profile with sign-in without a reload. Automated tests use MSW
and do not perform real Google OAuth.

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

Before setup writes are implemented, clarify why create/patch setup responses do
not list `415` despite having JSON request bodies, while profile and friendship
writes do. The documented 256 KiB body limit also has no explicit oversized-body
response status. No status or backend behavior is assumed here. CORS requires the
frontend origin in backend `ALLOWED_ORIGINS`; frontend code cannot configure that.
