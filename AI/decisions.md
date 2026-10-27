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

The committed `api/openapi.yaml` is the machine-readable backend contract. Generated types in `src/api/generated/schema.ts` come from `npm run api:generate` and own frontend transport typing.

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

## F011 — Shared credentialed API client

Status: accepted.

Use `VITE_API_URL` for the non-secret backend origin, defaulting to `http://localhost:8080`. The existing `openapi-fetch` client uses generated OpenAPI types and enforces `credentials: "include"`.

Feature queries/mutations reuse this foundation; do not create a competing client or token flow.


## F012 — Backend repository coordinates combined deployments

Status: accepted.

The backend repository `BlinovDev/rc-setup-hub` is the sole GitHub Actions coordinator for staging and production releases. The frontend keeps its own CI but does not hold deployment credentials or a competing deploy workflow.

Every server release is a combined pair of explicit backend and frontend commit SHAs. The coordinator validates both repositories, checks their OpenAPI compatibility, builds the frontend for the selected environment and packages it with the Go server and migrator.

Staging and production are rebuilt separately. Production accepts only SHAs reachable from each repository's `main`.

## F013 — Optional symmetric arm spacer totals

Status: accepted (Issues backend #3 / frontend #9, arm-spacing-v1).

The additive schema-v1 contract originated in backend PR #4; current committed
OpenAPI/types remain authoritative. Model optional
top/lower arm blocks on either axle as form UI state; generated ArmSpacing types
own transport. Preserve explicit zero, decimals and partial unknown values;
prune empty/removed blocks without defaults. Reuse suspension dot/comma parsing
with a nonnegative bound, keeping angle/link/oil rules unchanged. No shim
calculator, chassis rules or left/right asymmetry. Deploy only a compatible
explicit BE/FE SHA pair after separate authorization.

## F014 — Optional photos with immediate independent persistence

Status: accepted (backend #5/frontend #11, setup-photos-v1).

The photo contract originated in backend PR #6; use current committed OpenAPI
and generated types. Save new setup once, then
upload selected files with stable retry UUIDs and retained partial successes.
Existing owner photo writes save immediately and never reset unsaved technical
values. Separate gallery metadata and ephemeral authenticated media queries
follow the existing detail/session/friendship cancellation boundary. All list
covers use returned projections without per-item metadata lookup. Valid bundled
monochrome placeholder replaces the corrupt asset; it has no database identity
and no place in the ten-photo limit. No raw/public images, tokens/storage,
captions/sorting or mixed-version deployment.

## F015 — Persisted square thumbnail UX

Status: implemented (backend #10 / frontend #13, setup-photo-ux-v2).

Supersedes prior 3:2/no-crop thumbnail presentation. The crop extension originated
in backend PR #11; use current committed
OpenAPI/generated types, server-normalized full JPEG previews and integer square
coordinates/revisions. Apply/reset persist independently; Cancel preserves the
current frame and full media never changes. Touch/keyboard/slider controls are
bounded. Revision-bearing media identities refresh all joined list covers without
metadata N+1; old null crops remain centered until adjusted, no backfill/re-upload.
Photo limits, privacy, idempotent uploads and unsaved setup fields remain intact.
Mobile lists use compact square rows; desktop uses bounded square cards. Production
requires reviewed physical/paired live QA under the shared workflow/release gates.

## F016 — Public Explore and safe profiles

Status: accepted (backend #42 / frontend #45; product design backend #32).

Explore is `/` for guests and signed-in users. Public detail and safe owner profiles
reuse backend-authorized reads; owned/account/friendship/write routes stay protected.
Profiles default to the new public-only paginated endpoint for every viewer; an explicit
authenticated visible-to-you mode preserves owner/friend lists. Session transitions
purge/remount all viewer-dependent content and ephemeral media. Only successful
public setup detail receives index-eligible rendered metadata. See [SEO](seo.md) for
static HTML/crawler limits; SSR/prerender is a separate architectural decision.
