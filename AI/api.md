# Backend API integration

## Source of truth

The frontend must not invent backend transport schemas.

After the backend frontend-readiness phase is complete, the backend OpenAPI document is the canonical transport contract.

The frontend should generate TypeScript types from that contract into:

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
VITE_API_BASE_URL=http://localhost:8080
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

The backend contract currently includes or is expected to include:

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

GET    /api/v1/users/search?q=<nickname>
GET    /api/v1/friendships
POST   /api/v1/friendships
POST   /api/v1/friendships/{id}/accept
DELETE /api/v1/friendships/{id}
```

Always prefer the current OpenAPI document over this static list once OpenAPI exists.

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

Once backend OpenAPI exists, preferred direction is generated types plus a small OpenAPI-aware fetch client.

Components should consume feature-level query/mutation functions rather than call raw fetch directly.
