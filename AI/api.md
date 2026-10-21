# Frontend API integration

## Contract ownership

Backend [OpenAPI](https://github.com/BlinovDev/rc-setup-hub/blob/main/backend/api/openapi.yaml)
owns transport schemas/statuses. The frontend commits an exact copy at
[api/openapi.yaml](../api/openapi.yaml) and generates [types](../src/api/generated/schema.ts).
For paired unmerged work, consume the exact backend implementation-PR head, not a
stale historical PR/hash from documentation; link that PR and record the compatible
pair in the current PR. No sibling path or backend source inspection is required.

Copy the selected contract (or download GET /openapi.yaml from that exact backend),
then from frontend root run `npm run api:generate`. Commit both contract and generated
types; regenerate again with a clean diff. Never hand-edit types or duplicate DTOs.
Generated types do not perform runtime validation. Resolve code/contract/policy
mismatches explicitly instead of inferring an undocumented API or status code.

## Client and session boundary

Use src/api/client.ts (openapi-fetch over generated paths) through feature API/query/
mutation functions. VITE_API_URL is a public backend origin, default localhost:8080;
config rejects non-HTTP(S), embedded credentials, paths/query/fragment. No production
origin in source. Final fetch wrapper forces credentials: include; FormData owns its
multipart boundary. OAuth is browser navigation to /auth/google, not a fetch call.
Backend callback redirects to trusted APP_URL; React resolves GET /api/v1/me.

No Google/backend/session tokens in localStorage, sessionStorage, IndexedDB, React
state, URLs or persisted blobs. Backend HttpOnly sessions, CORS and visibility are
authoritative. A safe user profile is application UUID/nickname/avatar, not email.
Read public/friends/private values only as returned; never implement a client grant
matrix, hidden-count inference or merge mine/friends results into public discovery.

Current-user key is [auth,me], one-minute freshness, no polling/automatic retries,
with stale focus/reconnection refresh. 401 clears user/protected UI; non-401/network
failures offer retry, not logout. Logout 204 cancels older /me before clearing it;
failed logout retains identity. Catalog brands/models have five-minute freshness,
no polling/retry; models query only for a real brand. A model-list 404 is unavailable,
not an empty success. Canonical key factories and actual timing are in feature code.

## Forms and reads

- Chassis selection sends null for Custom, a real active model for a complete selection,
  and blocks incomplete brand selection. Keep unchanged historical inactive chassis
  by omitting chassis_model_id on PATCH. No fake UUID or catalog row.
- PATCH leaves omitted top-level fields unchanged; data is full replacement, not deep
  merge. Preserve untouched values. Empty notes send null; empty nested technical
  fields/parents prune; optional zero remains zero. Unsupported schemas are not editable.
- Suspension parsers preserve dot/comma precision/signed angles versus positive links;
  optional arm-spacing totals are finite nonnegative, zero/partial unknown permitted.
  No rounding/defaults. Backend/OpenAPI remain authoritative for constraints.
- Discovery uses search only, URL q/brand_id/model_id, fixed limit 20, opaque per-page
  cursor and repeated filters. Invalid filters avoid requests. Cards use historical
  chassis and safe owner projections, without detail fetches; don't restore stale cursors.
- Detail/profile UUID validation precedes requests. Detail 400/404 is generic unavailable;
  unsupported/empty technical data is explicit. Resolve owner via safe public profile
  independently; non-401 owner errors must not hide a readable setup. Share frontend
  detail URL without query; clipboard failure offers a selectable URL.
- Public profile succeeds before loading its visible setups; empty array is not missing
  profile. Profile/list errors retry independently. Render returned values only, no
  visibility filtering, N+1 detail calls or automatic detail-cache seeding.

## Scoped cache and relationship rules

Feature key factories own exact keys; no global invalidate-everything shortcut.
Setup create/patch refresh mine, affected detail, search and the returned owner's
visible list; delete uses cached detail/current user for owner and removes detail.
Profile nickname mutation updates current-user data; refresh affected visible public
identity/search displays when applicable. Preserve unrelated owner/query caches.

Friendships use backend incoming/outgoing/accepted buckets; item.user is already the
other participant. Search is explicit trimmed nickname <=64 characters, no null/empty
request, with relationship state from loaded buckets, not extra profile requests.
Send uses CreateFriendship; accept has no body; reject/cancel/remove use DELETE.
Mutations never auto-retry. Success refreshes friendships; stale send 409, accept
404/409 and delete 404 refresh with safe conflict feedback, not fabricated success.

Accept invalidates detail and the other user's visible list. Accepted removal,
including stale DELETE 404, cancels then removes detail and that list before refresh;
late requests must not restore access. Stale Accept 404/409 also cancels/removes that
list. Pending reject/cancel preserves visible-list caches. Do not broadly invalidate
auth, catalog, owned lists or public discovery after friendship changes.

## Private photos and crop transport

- Send the original File unchanged as multipart file + stable per-selection UUID
  request_id; no canvas re-encoding or manual Content-Type. Retry same bytes/UUID
  explicitly, never automatically. New setup is saved once first; photos never enter
  technical-data PATCH. Mutations preserve unsaved RHF values.
- Gallery/media keys are under detail with viewer/photo/variant, gcTime 0; private
  image fetch uses credentials and cache: no-store. Only ephemeral revocable object
  URLs; session identity remount discards protected queues/previews. Access-loss
  cancellation includes nested media; cached bytes never imply current permission.
- All covers use joined metadata, no per-card gallery/detail lookup. Success refreshes
  gallery/detail/mine/search/owner list; stale mutation 404/409 refreshes affected state.
- Crop request uses generated PhotoCropUpdate with expected_revision and null reset
  or integer x/y/size in normalized full JPEG pixels. Center uses short edge and
  floor half-offsets. Clamp/round drafts; backend validates bounds and concurrency.
- Thumbnail identities include returned revision; successful apply invalidates blobs/
  all cover projections. Full-image identity remains photo ID. Legacy NULL/revision 0
  is center-presented. Full bytes never change, no backfill or crop metadata N+1.
- Retry exact crop body/revision explicitly. Identical current/one-step-old retry is
  backend-safe; conflicting 409 requires reload before new draft; failed reload keeps
  draft. 404 prevents retry; 400/500/503 keeps saved crop with explicit retry.
- Upload 400 known-error strings use a safe allowlist with unknown fallback; no raw
  server detail. Distinguish non-JSON proxy 413, 401 session, 403 origin, 404 unavailable,
  409 changed/deleted selection, 503 busy and network/500 retained setup/retry.

Use the [product](product.md) and [UI](ui.md) for interaction rules,
[testing](testing.md) for regression/physical QA boundaries. Endpoint inventories,
exact limits/status schemas and decoder implementation are owned by backend contract,
code and [API guidance](https://github.com/BlinovDev/rc-setup-hub/blob/main/AI/api.md).
