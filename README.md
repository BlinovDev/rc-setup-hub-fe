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

This starter contains project instructions and the planned source tree only.

Do not manually bootstrap random application code before Phase FE 0. Let Codex implement the roadmap one phase at a time using `AI/roadmap.md`.

## Intended stack

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

The backend must complete its frontend-readiness phase before FE authentication integration is finalized. That phase should provide:

- a stable OpenAPI document;
- a frontend-friendly post-login redirect;
- documented CORS/cookie behavior;
- a complete current API contract.

See `AI/api.md`.

## Start development

After copying this starter into the empty repository:

```bash
git add .
git commit -m "Add frontend development plan"
git push
```

Then ask Codex to implement **FE Phase 0 only** from `AI/roadmap.md`.

## Phase 0 bootstrap

The application foundation is now implemented. The starter-state sections above
are retained as project history. Only the bootstrap and not-found routes exist;
no authentication or product flows are implemented.

Use Node.js 24 LTS (`.nvmrc`) and npm:

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Vite serves the frontend at `http://localhost:5173` with a strict port. The only
environment variable is `VITE_API_URL=http://localhost:8080`. This explicitly
requested name supersedes the earlier `VITE_API_BASE_URL` examples in `AI/*`.
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

Feature/shared directories contain only placeholders until their roadmap phases.
The QueryClient is created once per provider instance. The shell makes no API calls.

### OpenAPI workflow and API client

```bash
npm run api:generate
```

This runs `openapi-typescript api/openapi.yaml -o src/api/generated/schema.ts`.
Commit the generated file with contract changes; never edit it manually. Generated
files are excluded from lint/format rewrites. The OpenAPI source is preserved.
Generation and the generic client foundation are included in Phase 0 by explicit
request; the remaining Phase 1 features stay deferred.

`src/api/client.ts` uses `openapi-fetch` parameterized with generated `paths`, so
endpoint methods, parameters, request bodies and response bodies come from the
contract. It uses the origin from `src/api/config.ts`. Credentials default to
`include`, and the final fetch wrapper forces `include` even when a caller tries
to override it. No tokens are stored or read. Future feature query/mutation modules
should consume this client. HTTP errors remain available as typed `error` plus
`response.status`; network failures reject. Feature modules must handle these
deliberately rather than turn failures into empty data. OAuth routes require browser
navigation, as the contract specifies, rather than this fetch client.

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
profile endpoint and historical chassis display beyond the static endpoint list in
`AI/api.md`. All `/api/v1` endpoints, including public discovery, require a session.
Numeric/UUID/length constraints require runtime form validation later; generated
TypeScript types do not validate values at runtime.

Before setup writes are implemented, clarify why create/patch setup responses do
not list `415` despite having JSON request bodies, while profile and friendship
writes do. The documented 256 KiB body limit also has no explicit oversized-body
response status. No status or backend behavior is assumed here. CORS requires the
frontend origin in backend `ALLOWED_ORIGINS`; frontend code cannot configure that.
