# Project context entry point

## Product

RC Setup Hub is a POC for an RC drift community.

The frontend lets users authenticate, store RC car setups, discover public setups, share setup URLs, and manage friends who may view friends-only setups.

The frontend is not the source of truth for permissions or persisted state. The Go backend owns authentication, authorization, setup visibility, validation, friendship state, and database behavior.

## Core POC user flows

1. Sign in with Google through the backend.
2. View/update the current profile nickname.
3. Browse active chassis brands/models.
4. Create, view, edit, and delete owned setups.
5. Preserve optional setup values correctly, including explicit numeric zero.
6. Search public setups.
7. Open a stable setup detail/share URL.
8. Find users by nickname.
9. Send/accept/reject/cancel/remove friendship relationships.
10. View another user's setups according to backend visibility rules.

## POC non-goals

Do not add unless a later accepted decision requires them:

- comments;
- likes;
- favorites;
- setup revision history;
- ratings;
- notifications;
- groups/teams;
- chat;
- image uploads;
- normalized electronics catalog;
- user-created chassis catalog entries;
- offline write synchronization;
- native-mobile-specific behavior.

## Backend relationship

Backend repo:

```text
BlinovDev/rc-setup-hub
```

This frontend must consume the backend contract rather than inventing its own API semantics.

The machine-readable contract is already present at `api/openapi.yaml`. Generated TypeScript transport types live in `src/api/generated/schema.ts`; regenerate them with `npm run api:generate`.

FE Phases 0–4 are complete, including live authentication, `/settings` nickname-edit, owned CRUD and discovery/share smoke against the real local backend. API configuration uses `VITE_API_URL`; the committed contract and generated types remain the transport source of truth.

FE Phase 3 is complete, including manually verified live owned CRUD smoke: realistic creation, zero/blank numeric persistence, nested edit preservation, notes clearing, chassis change to Custom and confirmed deletion.

FE Phase 4 is complete, including manually verified live discovery/share smoke: public discovery and text/chassis filtering, stable frontend detail/share URLs, another authenticated session opening public detail, and generic unavailable state after visibility changed to private.

FE Phase 5 implementation and automated verification are complete: `/friends`, nickname search, incoming/outgoing/accepted sections, request/accept/reject/cancel/confirmed removal, and scoped setup-detail cache safety. Live two-user friendship smoke is pending. Phase 6 is not started; `/users/:userId` and another user’s visible setups remain deferred.

## Read next

- `AI/architecture.md`
- `AI/api.md`
- `AI/ui.md`
- `AI/roadmap.md`
- `AI/decisions.md`
