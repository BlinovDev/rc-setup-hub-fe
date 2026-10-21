# Frontend architecture

The React/TypeScript/Vite SPA talks to the Go API through credentialed HTTP, never
PostgreSQL or Google token APIs directly. Separate repositories/builds are intentional;
backend renders admin. Versions live in [package.json](../package.json) and lockfile;
accepted choices/rationale remain in [decisions](decisions.md).

## Ownership

- `src/app`: router, providers and shell; `src/api`: config/client/generated transport.
- `src/features/{auth,profile,chassis,setups,search,friendships,users}`: feature APIs,
  queries/mutations, forms/components and colocated tests. Shared code moves to
  `src/shared` only when multiple real consumers need it; avoid generic frameworks.
- TanStack Query owns remote state. Stable scoped keys and targeted invalidation;
  no Redux/Zustand, mirrored server-state store or global invalidate-everything strategy.
- Local state owns modal/draft/confirmation state; URL owns bookmarkable search/filter,
  detail and profile identity. React Router validates route/query parameters.
- React Hook Form and Zod own substantial forms and UX validation, never authorization.
  Full technical PATCH and numeric serialization follow [API](api.md).

## Security and transport

The shared openapi-fetch client uses generated paths and enforces credentials: include.
Backend owns Google/OIDC/HttpOnly sessions and current visibility; no OAuth callback,
Google token parsing or tokens in localStorage/sessionStorage/IndexedDB/React state.
Frontend hides unauthorized controls only for UX and never synthesizes granted access.
No secrets, untrusted HTML, open redirects or raw server/database details.

Use [API integration](api.md) for session/cache cancellation, private media, retries
and OpenAPI ownership; [UI](ui.md) for accessible mobile-first interaction. The backend
[deployment policy](https://github.com/BlinovDev/rc-setup-hub/blob/main/AI/deployment.md)
owns reverse proxy and combined releases; no competing frontend deploy pipeline.
