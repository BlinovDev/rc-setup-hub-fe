# Backend API integration

## Source of truth

The frontend must not invent backend transport schemas.

The current backend contract is already committed at `api/openapi.yaml`. It is the machine-readable source of truth for transport schemas.

Phase 0 established `npm run api:generate`, using `openapi-typescript` to generate `src/api/generated/schema.ts`. Generated types already live under:

```text
src/api/generated/
```

Do not manually duplicate generated request/response types.

This document explains frontend usage rules and expected behavior around the API. If it conflicts with the current backend OpenAPI document, stop and reconcile the contract instead of guessing.

## Base URL

Local development target:

```text
http://localhost:8080
```

Frontend environment should expose a non-secret API base URL, for example:

```text
VITE_API_URL=http://localhost:8080
```

Do not hardcode production URLs into source files.

## Credentials

All authenticated API calls must include browser credentials.

Equivalent fetch behavior:

```ts
fetch(url, {
  credentials: "include",
})
```

Do not store tokens in:

- localStorage;
- sessionStorage;
- IndexedDB;
- React state.

The session cookie is backend-owned and HttpOnly.

## Authentication flow

Expected frontend-ready flow:

1. User clicks "Sign in with Google".
2. Browser navigates to backend `/auth/google`.
3. Backend performs Google OAuth/OIDC.
4. Backend creates its application session.
5. Backend redirects to the configured frontend application URL.
6. React calls `GET /api/v1/me`.
7. `200` means authenticated; `401` means no valid application session.

The frontend must not parse Google OAuth tokens.

## Known POC endpoints

The current OpenAPI contract includes these POC endpoints:

```text
GET  /health

GET  /auth/google
GET  /auth/google/callback

POST /api/v1/auth/logout
GET  /api/v1/me
PATCH /api/v1/me

GET /api/v1/chassis/brands
GET /api/v1/chassis/brands/{brand_id}/models

POST   /api/v1/setups
GET    /api/v1/setups/{id}
PATCH  /api/v1/setups/{id}
DELETE /api/v1/setups/{id}
GET    /api/v1/me/setups
GET    /api/v1/users/{user_id}/setups
GET    /api/v1/setups/search

GET    /api/v1/users/{user_id}
GET    /api/v1/users/search?q=<nickname>
GET    /api/v1/friendships
POST   /api/v1/friendships
POST   /api/v1/friendships/{id}/accept
DELETE /api/v1/friendships/{id}
```

Always prefer `api/openapi.yaml` over this static overview. `GET /api/v1/users/{user_id}` returns the safe public profile for an authenticated caller.

## HTTP behavior

Expected common meanings:

```text
200 success
201 resource created
204 mutation succeeded with no body
400 invalid client input
401 authentication missing/expired
403 authenticated but forbidden for explicit forbidden flows
404 resource missing or intentionally concealed by authorization
409 state/uniqueness/concurrency conflict
500 unexpected server failure
```

Do not infer permissions solely from status codes beyond the documented endpoint contract.

## Authorization boundary

The backend is authoritative.

Frontend may hide edit/delete controls when the current user obviously is not the owner, but this is UX only.

Do not duplicate the full backend visibility matrix as a security mechanism.

Important setup behavior:

- public setup detail: visible to authenticated users;
- friends setup detail: owner + accepted friends;
- private setup detail: owner only;
- public search: public setups only, even for owner/friends;
- setup writes: owner only.

## Query/invalidation guidance

Suggested conceptual query groups:

```text
me
chassis.brands
chassis.models(brandId)
setups.mine
setups.detail(setupId)
setups.search(filters)
setups.user(userId)
friendships
users.search(query)
```

After profile nickname update:

- invalidate/update `me`;
- search/public owner display may become stale, so invalidate relevant user/setup search queries if visible in the current UI.

After setup create/update/delete:

- invalidate owned setups;
- invalidate affected setup detail;
- invalidate public search if public visibility may have changed;
- invalidate visible user setup lists as appropriate.

After friendship request/accept/delete:

- invalidate friendships;
- invalidate affected user setup lists;
- invalidate setup detail queries that may change visibility.

Do not introduce a global "invalidate everything" strategy unless temporary during early POC work and explicitly documented.

## Chassis behavior

The normal chassis catalog API returns active values for new selections.

The frontend must provide a synthetic option such as:

```text
Custom / not listed
```

Selecting it sends:

```json
{
  "chassis_model_id": null
}
```

Never create a fake `Custom` database catalog item.

Existing setups may refer to inactive historical chassis entries. Do not assume an existing setup becomes invalid merely because the current selection API no longer lists that model.

## Setup numeric semantics

Optional numbers are semantically nullable/omittable.

For example:

```text
toe_deg omitted
```

is different from:

```text
toe_deg = 0
```

Frontend form parsing must preserve this distinction.

Do not use patterns such as:

```ts
value || undefined
```

for numeric fields because that converts `0` to `undefined`.

## API client

Use one shared typed client.

Phase 0 already provides `src/api/client.ts`, using `openapi-fetch` with generated OpenAPI `paths`. Its base URL comes from `src/api/config.ts` and `VITE_API_URL`. The final fetch wrapper enforces `credentials: "include"`, even if a caller supplies a different option. Build feature queries and mutations on this existing foundation.

Components should consume feature-level query/mutation functions rather than call raw fetch directly.

## Implemented Phase 3 setup client behavior

Owned setup queries use `["setups", "mine"]` and `["setups", "detail", id]`. Mutations update/remove affected detail data and invalidate only the owned list; no discovery queries exist yet. Setup query/mutation 401 clears the existing `["auth", "me"]` state. Other statuses do not imply logout.

The schema-v1 form sends a complete replacement `data` document on PATCH, preserving unedited technical values. Empty nested sections are pruned; explicit numeric zero survives. Empty notes send `null` to clear. Historical chassis is displayed from `setup.chassis`, and unchanged chassis is preserved by omitting `chassis_model_id` from PATCH. Explicit chassis changes reuse the active selector.

Setup writes use generated request types and the existing credential-enforcing client. Unexpected statuses use generic safe errors; no undocumented setup 415 semantics are inferred. PATCH 409 requires explicit reload before retrying.
