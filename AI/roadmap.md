# Frontend POC implementation roadmap

Implement these phases in order.

Do not start the next phase until the current phase is reviewed, committed, pushed, and its checkpoint is green.

---

## FE Phase 0 — application bootstrap

Status: complete; implementation technically accepted.

Goal: create a clean, runnable React/TypeScript foundation without implementing product flows.

Completed foundation:

- bootstrap React + TypeScript with Vite in the existing repository;
- preserve all existing `AGENTS.md` and `AI/*` documentation;
- add React Router;
- add TanStack Query;
- add React Hook Form and Zod dependencies for later phases;
- add Vitest + React Testing Library;
- add MSW test dependency/setup;
- establish formatter/linter/typecheck/build scripts;
- create the agreed feature-oriented source tree;
- commit `api/openapi.yaml` as the machine-readable backend contract;
- install `openapi-typescript` and establish `npm run api:generate`;
- generate `src/api/generated/schema.ts`;
- add the shared typed `openapi-fetch` client;
- add `VITE_API_URL` configuration helper;
- enforce `credentials: "include"` at the final fetch boundary;
- add minimal app/providers/router shell;
- add a simple not-found route;
- no backend business features yet.

Tests/checkpoint:

```text
dev server starts
API generation passes
formatting passes
lint passes
typecheck passes
tests pass
production build passes
```

Do not implement login, profile, setups, friendships, or search yet.

---

## FE Phase 1 — authentication foundation

Status: complete, including automated verification and manually verified live backend/browser smoke.

Prerequisite:

Phase 0 already provides the committed OpenAPI contract, generation workflow, generated types, typed API client, `VITE_API_URL` configuration and enforced cookie credentials. Reuse this foundation. Authentication integration must follow the current contract for backend login redirects and CORS/cookie behavior.

Goal: build authentication state and an authenticated application shell on the existing API foundation.

Tasks:

- current-user (`GET /api/v1/me`) query using the existing typed client and TanStack Query;
- authentication state derived from the current-user query;
- Google login action uses browser navigation to backend `/auth/google`;
- logout mutation;
- authenticated/unauthenticated route shell;
- 401/session-expired behavior;
- basic loading/error states;
- no token storage in browser storage.

Tests:

- unauthenticated state;
- authenticated state;
- Google login browser navigation;
- logout mutation and resulting authentication state;
- 401/session-expired behavior;
- loading/error states;
- credentials-enabled authentication API behavior;
- no localStorage/sessionStorage auth dependency.

Checkpoint:

Verified manually at `http://localhost:5173` with the real local backend: Google login navigated through backend OAuth, the callback redirected to the frontend, `GET /api/v1/me` returned the authenticated user, and Sign out changed the UI back to Sign in without a page reload.

---

## FE Phase 2 — profile + chassis catalog

Status: complete, including automated verification and manually verified live `/settings` nickname-edit smoke. Chassis selector automated tests were sufficient for Phase 2 implementation review; the selector is now integrated into the Phase 3 setup form.

Goal: support user profile editing and setup-selection dependencies.

Tasks:

- settings/profile route;
- display avatar/nickname;
- update nickname;
- list active chassis brands;
- load models for selected brand;
- represent synthetic `Custom / not listed` option as `chassis_model_id = null`;
- reusable chassis selector for setup forms.

Tests:

- nickname update validation/error states;
- brand/model loading;
- switching brand resets incompatible model selection;
- custom option produces null model id.

Checkpoint:

Live `/settings` nickname-edit smoke was manually verified against the real backend. Automated tests verify Yokomo -> RD2.0 and Custom selection; no standalone live selector route was required in Phase 2.

---

## FE Phase 3 — owned setups CRUD

Status: complete, including automated verification and manually verified live owned CRUD smoke.

Goal: complete the primary setup-management workflow.

Tasks:

- `/my/setups` list;
- create setup route;
- edit setup route;
- delete confirmation;
- setup form sections from `AI/ui.md`;
- title/chassis/visibility/notes;
- suspension front/rear;
- shocks front/rear;
- electronics;
- correct optional-number parsing;
- use backend schema version returned by API, never client-select it;
- mutation invalidation for owned setup lists/details.

Tests:

- create/edit/delete;
- explicit `0` survives form parsing;
- empty optional numeric input is omitted;
- custom chassis sends null;
- API validation/conflict errors display usefully;
- destructive action confirmation.

Checkpoint:

Verified manually against the real backend: realistic creation, explicit zero persistence and blank optional numbers, edit preserving shocks/electronics/links, notes clearing, chassis change to Custom, delete confirmation and deletion.

---

## FE Phase 4 — public discovery + setup detail/share route

Status: complete, including automated verification and manually verified live discovery/share smoke.

Goal: browse public setups and open stable setup URLs.

Tasks:

- `/` public discovery;
- `q` search;
- brand/model filters;
- URL-synchronized search state;
- cursor pagination/load-more;
- public result cards;
- safe public owner identity on cards and public-owner lookup on detail; full navigable `/users/:userId` profiles remain Phase 6;
- `/setups/:setupId` detail route;
- generic unavailable/not-found state;
- share/copy-link action using stable route URL.

Tests:

- query/filter URL state;
- load-more pagination;
- no duplicate displayed pages;
- setup detail states;
- 404/private/unavailable does not attempt to infer protected state.

Checkpoint:

Verified manually: public setup appeared in discovery; text and chassis filters worked; stable detail opened and share copied the frontend URL; another authenticated session opened public detail; after changing visibility to private, that session received only the generic unavailable state.

---

## FE Phase 5 — friendships

Status: complete, including automated verification and manually verified live two-user friendship/access smoke.

Goal: provide the complete social request workflow.

Tasks:

- `/friends` route;
- nickname user search;
- send request;
- incoming list;
- outgoing list;
- accepted list;
- accept incoming;
- reject incoming;
- cancel outgoing;
- remove accepted friendship;
- invalidate relevant setup visibility queries after accept/remove.

Tests:

- search user;
- request state;
- incoming/outgoing rendering;
- accept/reject/cancel/remove actions;
- relevant query invalidation.

Checkpoint:

Verified manually: User A searched B and sent a request; B saw incoming and accepted; friends-only setup became readable; removal made that setup unavailable again.

---

## FE Phase 6 — other user profiles and visible setups

Status: complete, including manually verified live profile/visibility smoke.

Goal: connect discovery/social flows to another user's visible setups.

Tasks:

- `/users/:userId` route;
- display safe public profile information available from API context;
- list setups visible to current caller;
- link from public search owner to user route;
- link from friendship list to user route;
- handle empty/404/error states without guessing hidden resources.

Tests:

- unrelated user sees returned public setups;
- accepted friend UI displays returned public+friends setups;
- private setups are never synthesized client-side;
- links between discovery/friends/user profile work.

Checkpoint:

Live smoke verified: unrelated B sees public only; after acceptance B sees public + friends, never private; removal restores public only. Discovery/friend identity → profile → detail links work.

---

## FE Phase 7 — UX and responsive polish

Status: implementation and automated verification complete; live mobile/UX smoke pending.

Goal: make the POC comfortable for real track use.

Tasks:

- mobile navigation;
- consistent loading skeletons/spinners;
- empty states;
- retry states;
- toast/inline mutation feedback;
- accessible dialogs/confirmations;
- setup form section navigation;
- responsive layout cleanup;
- sensible form autofocus/input modes for numeric fields;
- final visual consistency pass.

Implemented: fixed phone bottom navigation and compact desktop header; shared native controls/feedback/visibility labels; wrapping cards and technical definition lists; open setup sections with sticky anchor navigation and one fixed mobile save bar above navigation; contextual inline confirmations with Cancel focus and focus restoration. API/session/cache/form serialization behavior is unchanged.

Live checkpoint pending: around 375px, verify login, discovery/filters, create/edit long setup, friends, profiles, detail and settings. Check no horizontal overflow, reachable navigation and save, phone numeric keyboard, obvious errors, confirmations and long content wrapping without fixed-control overlap; confirm desktop comfort.

Do not add new product features in this phase.

Tests/checkpoint:

- critical routes usable at phone viewport sizes;
- keyboard/basic accessibility checks;
- existing feature tests remain green;
- production build remains green.

---

## FE Phase 8 — E2E, deployment, optional PWA

Status: not started.

Goal: prepare the frontend for POC users.

Tasks:

- Playwright core-flow tests;
- production API base URL configuration;
- production build/deploy documentation;
- reverse-proxy routing assumptions documented;
- session-expiry smoke behavior;
- optional PWA manifest/installability if still desired;
- no offline mutation sync.

Minimum E2E path:

1. authenticated session;
2. create setup;
3. edit setup;
4. publish setup;
5. find in public discovery;
6. open detail route;
7. friendship request/accept;
8. friends-only access works;
9. remove friendship;
10. access disappears;
11. delete setup.

Checkpoint:

A production build can be deployed and the primary POC path passes end-to-end.
