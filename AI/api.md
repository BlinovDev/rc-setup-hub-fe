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

After friendship mutations:

- invalidate/refetch `["friendships"]`;
- accept invalidates `["setups", "detail"]`;
- accepted removal cancels in-flight detail requests and removes that family;
- pending send/reject/cancel does not grant setup visibility;
- do not invalidate public discovery, auth, chassis or owned lists unnecessarily;
- Phase 6 user-list queries use `userSetupsKey(userId)`; accept invalidates the other participant’s list, and accepted removal cancels/removes it.

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

Owned setup queries use `["setups", "mine"]` and `["setups", "detail", id]`. Mutations update/remove affected detail data and invalidate the owned list plus the `["setups", "search"]` family. Setup query/mutation 401 clears the existing `["auth", "me"]` state. Other statuses do not imply logout.

The schema-v1 form sends a complete replacement `data` document on PATCH, preserving unedited technical values. Empty nested sections are pruned; explicit numeric zero survives. Empty notes send `null` to clear. Historical chassis is displayed from `setup.chassis`, and unchanged chassis is preserved by omitting `chassis_model_id` from PATCH. Explicit chassis changes reuse the active selector.

Setup writes use generated request types and the existing credential-enforcing client. Unexpected statuses use generic safe errors; no undocumented setup 415 semantics are inferred. PATCH 409 requires explicit reload before retrying.

## Implemented Phase 4 discovery and detail

Discovery uses only `GET /api/v1/setups/search` with fixed limit 20 and normalized URL filters `q`, `brand_id`, `model_id`. Infinite query keys are `["setups", "search", { q, brandId, modelId, limit }]`; cursor is opaque page state and each page repeats filters. Public-only membership is backend-owned; owned/visible-user lists are never merged into discovery. Cards use historical chassis and public owner from search responses without detail requests.

The stable `/setups/:setupId` route reuses the existing detail API/key. Invalid UUIDs avoid requests; 400/404 use a generic unavailable state. Schema-v1 read-only display preserves zero, and unsupported versions are not interpreted. Detail resolves owner through `GET /api/v1/users/{user_id}` using `["users", "public", userId]`, with no email and a safe non-401 failure fallback. Search/detail/owner 401 clears current-user state; other failures do not imply logout. Clipboard sharing copies the frontend route without query parameters. Public identities now link to the Phase 6 user-profile route.

## Implemented Phase 5 friendship client

One friendship-list query uses `["friendships"]` and the backend’s incoming/outgoing/accepted buckets. `FriendshipItem.user` is used directly as the other participant; requester/addressee direction is never reconstructed. Explicit nickname search uses `["users", "search", normalizedQuery]`, with trimmed <=64 Unicode characters, no null bytes and no empty/invalid requests. Search results derive relationship state from the list by `item.user.id`; no extra profile requests or fabricated friendship items.

Send uses generated `CreateFriendship`; accept has no request body; reject/cancel/confirmed accepted removal share DELETE. All successful mutations refetch the list. Send 409, accept 404/409 and delete 404 safely report stale/conflicting state and refetch without automatic mutation retries. Accepted-removal 404 conservatively cancels/removes detail caches as well. Non-401 failures do not clear auth; all friendship/search 401 uses the existing current-user session pattern.

Accept invalidates the detail family; accepted removal cancels then removes it so older responses cannot restore stale authorized data. Public discovery remains unaffected. Phase 6 extends cache safety to the specific other participant’s visible-setup list and adds profile navigation.

## Implemented Phase 6 user profiles

`/users/:userId` validates UUID before the existing `usePublicUser` resource. Profile 400/404 is generic unavailable; profile 500/network is retryable. Only profile success enables `GET /api/v1/users/{user_id}/setups`, keyed by canonical `userSetupsKey(userId)` (`["setups", "user", userId]`). An empty array is not evidence of a missing profile. List 400/500/network preserves the profile with independent retry; no invented list-404 branch exists. Both resources reuse current-user 401 handling.

Render only the returned array, with no visibility matrix/filtering or merges with mine/search. Cards use historical chassis, and neither fetch nor seed individual detail caches. Profile, discovery, detail and friendship identities use safe nickname/avatar links.

Accept invalidates the specific other user’s list. Accepted removal (including stale 404) cancels and removes that list before friendship refresh, retaining detail cleanup. Stale Accept 404/409 cancels/removes the affected list conservatively; normal pending delete preserves it. Create/patch invalidate the returned owner’s list; delete identifies the owner from cached detail or current-user cache. All user-list operations are scoped and leave unrelated user lists intact.
