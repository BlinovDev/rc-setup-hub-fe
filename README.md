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
