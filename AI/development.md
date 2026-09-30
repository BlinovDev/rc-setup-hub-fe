# Frontend development guide

## Main principle

Build a small, understandable POC that can be changed quickly after real track users try it.

Do not turn the client into a generalized design system or state-management framework.

## TypeScript

Use strict TypeScript.

Avoid `any` unless interacting with an unavoidable untyped boundary and document why.

Prefer generated backend transport types once OpenAPI exists.

Use small frontend-specific view-model types only when they represent UI state rather than duplicating API schemas.

## Components

- Prefer focused components.
- Keep page orchestration near route/page components.
- Keep feature-specific components inside their feature.
- Move a component to `shared/components` only when multiple features genuinely use it.
- Avoid giant configurable "universal" components.

## API access

All backend access goes through the shared API client and feature API/query functions.

Do not scatter raw fetch calls through components.

All authenticated requests use credentials.

Do not catch API errors and silently turn them into empty data unless the endpoint contract explicitly says so.

## TanStack Query

Use TanStack Query for remote/server state.

- define stable query keys;
- keep query functions outside rendering code where practical;
- invalidate narrowly after mutations;
- do not mirror query data into another global state store.

## Forms

Use React Hook Form for substantial forms.

Use Zod where it improves parsing and field-level feedback.

Backend validation remains authoritative; frontend validation exists for UX.

For optional numeric fields, write explicit parsing helpers that distinguish:

```text
"" -> undefined
"0" -> 0
```

## Routing

Use React Router.

Route parameters and URL search parameters should be validated before use.

Public setup search filters should be URL-addressable so discovery state can be shared/reloaded where practical.

## Environment

Expected non-secret frontend configuration:

```text
VITE_API_BASE_URL=http://localhost:8080
```

Add more frontend env variables only when needed.

Never expose backend secrets through `VITE_*` variables.

## Styling

Use a simple mobile-first styling approach.

Tailwind CSS is the preferred starting direction for the POC. A component library may be added selectively if it saves implementation time, but do not import a large design system simply to decorate the app.

Keep visual tokens simple and consistent.

## Error handling

The UI should translate expected API states into useful user-facing behavior.

Examples:

- 401 -> resolve session/login flow;
- 400 -> validation/invalid request feedback;
- 404 setup detail -> "not found or unavailable" rather than guessing whether it is private;
- 409 -> state conflict/duplicate/concurrent-change feedback;
- 500 -> generic retryable error without backend internals.

Do not expose raw server/database errors.

## Security

- no auth tokens in frontend storage;
- no secrets in repository;
- no trust in hidden buttons as authorization;
- no rendering raw untrusted HTML;
- use normal React escaping;
- avoid open redirects based on arbitrary query parameters;
- keep API base URL configuration controlled.

## Definition of done

For every phase/change:

- formatter/linter passes;
- TypeScript check passes;
- unit/component tests pass;
- production build passes;
- relevant docs updated;
- no unrelated feature scope added.
