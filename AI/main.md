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

FE Phases 0–5 are complete, including live authentication, `/settings` nickname-edit, owned CRUD and discovery/share smoke against the real local backend. API configuration uses `VITE_API_URL`; the committed contract and generated types remain the transport source of truth.

FE Phase 3 is complete, including manually verified live owned CRUD smoke: realistic creation, zero/blank numeric persistence, nested edit preservation, notes clearing, chassis change to Custom and confirmed deletion.

FE Phase 4 is complete, including manually verified live discovery/share smoke: public discovery and text/chassis filtering, stable frontend detail/share URLs, another authenticated session opening public detail, and generic unavailable state after visibility changed to private.

FE Phase 5 is complete, including live two-user friendship/access smoke: search → request → incoming → accept → friends-only readable → remove → unavailable.

FE Phase 6 is complete, including live profile/visibility smoke: `/users/:userId`, shared safe public-profile resource, backend-returned visible setups, discovery/detail/friend identity links and targeted user-list cache safety. The live smoke verified public-only while unrelated, public + friends after acceptance, private remaining hidden, public-only after removal and profile/detail navigation. FE Phase 7 implementation and automated verification are complete; live mobile/UX smoke is pending. Phase 8 is not started.

## Read next

- `AI/architecture.md`
- `AI/api.md`
- `AI/ui.md`
- `AI/roadmap.md`
- `AI/decisions.md`

## Deployment

See `AI/deployment.md` for the concrete CI, paired-release, staging, production and recovery contract.
