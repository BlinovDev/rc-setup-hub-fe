# Frontend architecture

## High-level topology

```text
Browser
  |
  | React SPA
  v
RC Setup Hub frontend
  |
  | HTTPS/JSON + credentials
  v
RC Setup Hub Go backend
  |
  v
PostgreSQL
```

The frontend never talks directly to PostgreSQL or Google APIs for application authentication.

## Application stack

Preferred POC stack:

- React + TypeScript;
- Vite;
- React Router;
- TanStack Query for server state;
- React Hook Form for substantial forms;
- Zod for client-side parsing/form validation where useful;
- generated OpenAPI types;
- a small typed API client;
- Vitest + React Testing Library;
- MSW for HTTP-boundary tests;
- Playwright for later end-to-end tests.

Do not add Redux/Zustand by default.

## Source organization

Use feature-oriented modules:

```text
src/
├── app/
│   ├── App.tsx
│   ├── router.tsx
│   └── providers.tsx
├── api/
│   ├── client.ts
│   ├── config.ts
│   └── generated/
│       └── schema.ts
├── features/
│   ├── auth/
│   ├── profile/
│   ├── chassis/
│   ├── setups/
│   ├── search/
│   ├── friendships/
│   └── users/
├── shared/
│   ├── components/
│   ├── hooks/
│   └── utils/
├── main.tsx
└── styles.css
```

Each feature may contain its own:

- API/query functions;
- components;
- forms;
- route/page components;
- hooks;
- tests;
- local view-model helpers.

Do not create abstraction folders before they have real consumers.

## Existing API foundation

Phase 0 provides an `openapi-fetch` client typed from the committed `api/openapi.yaml`. Run `npm run api:generate` to regenerate `src/api/generated/schema.ts`. The API origin is configured through `VITE_API_URL`, defaulting to `http://localhost:8080`. All client requests enforce `credentials: "include"`.

Phase 1 builds authentication queries and session-aware UI on this existing foundation.

## Server state

TanStack Query owns backend-derived state:

- current user;
- chassis catalog;
- owned setups;
- setup detail;
- public setup search;
- friendships;
- user search;
- another user's visible setups.

Mutations should invalidate or update relevant query keys deliberately.

Do not copy server responses into a second global store without a demonstrated need.

## Local UI state

Keep local UI state local:

- dialog open/closed;
- current form section;
- temporary search input;
- confirmation state.

URL-addressable state should generally live in the URL when useful:

- public search query;
- selected brand/model filters;
- shareable setup ID;
- another user's ID.

## Forms

Use React Hook Form for setup create/edit and other non-trivial forms.

The setup form may be visually divided into sections, but it remains one logical setup document.

Important semantic rule:

```text
empty numeric input != numeric zero
```

For optional numbers:

- empty UI input should become omitted/undefined where the backend contract expects omission;
- `0` must remain the numeric value `0`.

Do not use truthy/falsy conversion that drops valid zero values.

## Authentication

Authentication is backend-owned.

The browser begins Google login at a backend route. Google returns to the backend. The backend establishes its own HttpOnly session cookie and redirects to the frontend app.

The React app then calls `/api/v1/me` to resolve the current application user.

The frontend never stores Google access tokens or application session tokens.

## Production deployment direction

Repositories remain separate.

A preferred production topology is one public origin through a reverse proxy:

```text
/          -> frontend static files
/api/*     -> Go backend
/auth/*    -> Go backend
/admin/*   -> Go backend
/health    -> Go backend
```

This is a deployment preference, not a requirement for local development.
