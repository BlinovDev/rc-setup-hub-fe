# Accepted frontend decisions

Codex must not silently contradict these decisions.

## F001 — Separate frontend repository

Status: accepted.

The frontend lives in `BlinovDev/rc-setup-hub-fe`, separately from the Go backend.

Preferred local path:

```text
/Users/anton/Programming/React/rc-setup-hub-fe
```

## F002 — React + TypeScript + Vite

Status: accepted.

The POC user client is a React web application using TypeScript and Vite.

Do not replace it with Next.js or a native application without a new accepted decision.

## F003 — Backend-owned auth

Status: accepted.

Google OAuth/OIDC and application sessions are backend responsibilities.

The frontend uses the backend HttpOnly session cookie and never stores auth tokens itself.

## F004 — OpenAPI-backed transport types

Status: accepted.

The committed `api/openapi.yaml` is the machine-readable backend contract. Phase 0 established generated transport types in `src/api/generated/schema.ts` via `npm run api:generate`; these types are the source of truth for frontend transport typing.

Do not maintain parallel hand-written API DTOs for the same contract.

## F005 — TanStack Query for server state

Status: accepted.

Backend-derived state uses TanStack Query.

Do not introduce Redux/Zustand unless future requirements demonstrate a real need.

## F006 — Feature-oriented source structure

Status: accepted.

Organize most code by domain feature rather than global technical buckets.

## F007 — Mobile-first responsive POC

Status: accepted.

Primary usage includes phones at RC drift tracks.

Core workflows must remain usable on small touch screens.

## F008 — Backend is authorization source of truth

Status: accepted.

Frontend visibility/action decisions are UX only.

Do not implement a second independent permission system in React.

## F009 — Preserve omitted vs zero numeric semantics

Status: accepted.

For optional setup numbers, empty/unknown and explicit `0` are different values and must remain different in form parsing and requests.

## F010 — Simplicity over speculative frontend architecture

Status: accepted.

Do not add offline sync, complex global state, a large design system, micro-frontends, or generalized form engines unless real requirements justify them.

## F011 — API foundation established in Phase 0

Status: accepted.

Use `VITE_API_URL` for the non-secret backend origin, defaulting to `http://localhost:8080`. The existing `openapi-fetch` client uses generated OpenAPI types and enforces `credentials: "include"`.

OpenAPI generation and the shared client belong to the completed Phase 0 foundation. Phase 1 builds current-user queries, authentication state, login/logout and session behavior on that foundation.
