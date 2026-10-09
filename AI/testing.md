# Frontend testing strategy

Testing is a progress gate for vibe-coded development.

## Test layers

### 1. Unit tests

Use Vitest.

Good targets:

- numeric form parsing (`""` vs `"0"`);
- URL/filter parsing;
- cursor/load-more helpers if frontend-specific logic exists;
- small formatting/view-model helpers;
- error mapping.

### 2. Component/route tests

Use React Testing Library.

Test behavior visible to the user rather than implementation details.

Examples:

- authenticated shell renders current user;
- login state renders correctly;
- setup form preserves zero values;
- friendship request sections show correct actions;
- inaccessible setup route renders a generic unavailable state.

### 3. API-boundary tests

Use MSW to mock the backend HTTP boundary for frontend tests.

Do not mock deep internal implementation details of the API client when an HTTP-level mock is practical.

Test representative responses:

```text
200 / 201 / 204
400
401
404
409
500
```

### 4. End-to-end tests

Add Playwright after core screens exist.

Minimum eventual E2E flow:

1. resolve authenticated test session;
2. list chassis;
3. create setup with explicit zero numeric value;
4. edit setup;
5. make setup public;
6. find it in discovery;
7. open stable detail route;
8. second user sends/accepts friendship;
9. friends-only visibility works;
10. remove friendship and access disappears;
11. delete setup.

Real Google OAuth should not be required for the normal automated frontend suite. Use an appropriate test session/backend strategy for E2E.

## Mandatory regressions

### Optional numeric zero

At least one test must prove:

```text
input "0" -> request numeric 0
input ""  -> omitted/undefined
```

### Auth storage

No frontend test or implementation should rely on localStorage/sessionStorage tokens.

### Visibility UX

The frontend may display actions based on known ownership, but tests must not assume this is the security boundary.

A backend 404 for an inaccessible setup should render the same generic unavailable UI as a missing setup unless the backend contract says otherwise.

### Search

Public discovery tests should verify filters/query state and pagination behavior without showing friends/private records supplied outside the endpoint contract.

### Friendships

Test:

- incoming request accept/reject controls;
- outgoing cancel control;
- accepted remove control;
- mutation invalidates/reloads friendship data.

## Phase verification commands

Phase FE 0 should establish canonical scripts such as:

```bash
npm run lint
npm run typecheck
npm test -- --run
npm run build
```

Exact script names may be finalized in FE 0 and then must remain stable unless there is a reason to change them.

## Phase 4 automated coverage and live checkpoint

MSW/RTL tests cover URL initialization and validation, explicit text submission, brand/model reset, first-page and cursor-page errors/retries, ordered pagination without duplicates, historical/Custom cards and absence of N+1 detail requests. Detail tests cover generic unavailable states, full technical display with zero, empty/null values, unsupported versions, public owner lookup/fallback, owner-only Edit links, session expiry and clipboard success/fallback. Existing create/update/delete tests verify narrow search-family invalidation.

Phase 3 live owned CRUD smoke is complete. Phase 4 live backend/browser discovery and stable share-link smoke is complete, including cross-session public access and generic unavailable state after a change to private. Full user profiles and friendships are not Phase 4 tests.

## Phase 5 automated coverage and live checkpoint

MSW/RTL tests cover direct other-participant bucket rendering and empty groups; normalized explicit nickname search, invalid/empty suppression and public-only identity fields; relationship-derived search states with no extra profile requests; send/accept/reject/cancel/confirmed removal; stale-state 404/409 races and no automatic POST retry; per-relationship pending controls; 500/network retries; and list/search/send/accept/delete 401. Cache regressions verify accept invalidation, accepted-removal cancellation and detail removal, safe later detail refetch, and preservation of unrelated/owned/catalog/public-search caches.

Phase 5 is complete, including manually verified live two-user friendship/access smoke: A searches B → sends → B accepts → friends-only detail becomes available → either removes → detail becomes unavailable. Real Google multi-user authentication is not automated. Phase 6 profile/visible-setup routes are now implemented.

## Phase 6 verification and live checkpoint

MSW/RTL tests cover UUID validation; profile-before-list sequencing; unavailable profile versus empty list; retryable profile/list errors and 401; safe avatar/nickname; exact rendering of returned public/friends/private values without visibility queries; historical/Custom cards; identity/detail navigation; absence of per-card requests/detail seeding; public-profile cache reuse; scoped setup mutation invalidation; specific other-user accept invalidation; accepted removal and stale 404 cache purging; stale Accept 404/409; pending delete preservation; and canceled user-list responses unable to restore old data.

Phase 6 is complete, including manually verified live user-profile visibility smoke: unrelated sees public, accepted friend sees public + friends without private, removal restores public only, and discovery/friend → profile → detail links work. Real multi-account Google auth is not automated.

## Phase 7 verification and live checkpoint

Automated verification is complete. RTL tests cover labeled/current navigation, section anchor targets, one pending/blocked submit action, first-invalid-field focus and associated errors, decimal text inputs, long content, empty-state navigation and confirmation focus/restoration. Existing numeric serialization, historical chassis, pagination, auth and cache-race regressions remain unchanged and passing.

Live mobile/UX smoke is pending: use about 375px and desktop with the real backend for login, discovery/filters, create/edit, friendships, profile, detail and settings. Check overflow, touch targets, navigation/save overlap, phone keyboard, validation, confirmations and long values. Phase 8 is not started; no Playwright or deployment work was added.


## Issue #3 account navigation coverage

MSW/RTL regressions cover drawer identity, accessible expanded/control state, canonical safe social links in both drawer/footer, retained bottom navigation, explicit close/native cancel event wiring and focus restoration, desktop resize dismissal, and sign-out pending/error/retry/success. jsdom lacks native dialog APIs, so these tests shim only the showModal/close boundary; native focus containment and Escape should also be checked in browser QA.

QA checklist at about 375px and desktop: avatar/menu versus desktop nickname/sign-out; canonical icon destinations; Close initial focus, Tab/Shift+Tab containment, Escape and restored focus; long nickname and short-height scrolling; safe-area/bottom-navigation spacing; sign-out pending/error/retry. No deployment is performed as part of the implementation-only PR.

## Issue #5 profile and search friendship coverage

MSW/RTL tests cover direct-profile relationship states, self on profile/search, send and exact-label Accept friendship from both surfaces, correct existing relationship ID/no accept body, duplicate suppression, state refresh across navigation, visible setup refresh after acceptance, profile friendship loading/error/retry, stale send 409 and accept 404/409, and list/send/accept 401. Existing relationship-management and cache-race regressions remain required.

Manual QA uses two accounts in separate sessions. A opens B's direct profile and sends: Add friend becomes Request sent, with no friends-only access yet. B opens/searches A and accepts using Accept friendship: both show Friends after refresh, and the accepting viewer's visible setup list refreshes. Remove via existing Friends controls and repeat acceptance from the other surface. Verify own profile/search has no CTA, and removal revokes friends-only access.

Check profile and search cards at 320px, 375px, 390px, 768px and desktop with normal/long nicknames, present/missing avatars, and Add friend/Accept friendship/status. Identity/action must not overlap or cause horizontal overflow; 320px uses a right-aligned separate action row. Check keyboard focus and pending/error feedback. Real Google multi-account QA remains a live checkpoint; local browser geometry checks do not establish backend authorization.
