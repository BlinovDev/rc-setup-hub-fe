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

## Suspension decimal input coverage (Issue #7)

Parser/schema/serialization regressions cover every front/rear angle and link length with dot/comma fractions, signed angles, finer precision, scientific notation retained from the existing parser, explicit zero versus blank, and mixed/repeated separators, malformed/non-finite input and positive-only required lengths. Comma acceptance is limited to suspension measurements; existing shock-oil syntax remains unchanged.

RTL/MSW regressions use typing and paste for create/update, all six angles and front/rear dynamic links. They verify numeric POST/PATCH payloads, detail display, edit hydration, unchanged decimals after an unrelated save, re-opening after update, dynamic row add/remove and accessible invalid-input errors with no HTTP writes.

QA checklist at desktop and ~375px: create with angles `-1.5`, `6.8`, `0`, and links `16.2`; repeat with comma equivalents. Save, open detail, reopen edit, change only the title and save/reopen again. Update an angle to `-0.25`, a link to `0.25`, clear an optional angle, and add/remove front/rear links. Confirm invalid `16,2.3`, zero/negative/blank lengths cannot save and retained values remain editable. Check real mobile keyboard locale/decimal key, typing and actual clipboard paste separately from desktop/mobile-size browser emulation. Live backend persistence and real-device QA must be reported explicitly; mocked API tests alone do not prove database persistence.

Implementation browser checkpoint: headless Chromium with mocked HTTP passed the create/detail/edit/save/reopen flow at 375px and 1280px for both separators, including malformed/zero-length blocking and dynamic link rows. Sequential key input was exercised; inserted text simulated pasted text without claiming an OS-clipboard test. Before the fix, dot decimals submitted successfully and comma decimals failed validation; the originally reported dot rejection was not reproduced. Physical iOS/Android keyboards, actual clipboard paste and live backend/database persistence remain pending QA. No merge or deployment was performed.

## Arm spacing regressions (Issue #9)

Unit coverage in form/armSpacing.test.ts exercises both arms/both axles/both
positions: finite nonnegative dot/comma fractions, finer precision, zero versus
blank, partial/all-zero hydration, empty/null/removed blocks and parent pruning,
legacy data, sibling/measurement preservation, negative/non-finite/malformed
rejection. Existing decimal, positive link/oil and signed-angle regressions stay
required. RTL/MSW ArmSpacing.test.tsx covers optional initial/add/remove/re-add,
blank saving, typed/pasted create numeric payloads, detail/reopen, title-only
preservation, clear/remove/update and associated invalid-input errors/focus with
no POST/PATCH writes. TechnicalData.armSpacing.test.tsx covers legacy, empty/null
blocks, partial unknown values and all-zero detail. These use mocked HTTP, not
live database persistence or physical devices.

Use Node 24: npm ci; npm run api:generate; npm run format:check; npm run lint;
npm run typecheck; npm test -- --run; npm run build. After committing the generated
types, regenerate again and require no diff. Compare api/openapi.yaml bytes with
backend PR #4 head 7393a6adf0fd743f896d64be2e4870cbbb298683.

Browser checkpoint in this implementation runtime was blocked: Chromium was
installed but could not launch because Unix socket creation returned Operation
not permitted. No 375px/desktop browser geometry result is claimed. RTL/MSW
typing/paste tests passed; physical keyboard/OS clipboard and live DB QA remain
pending.

For separately authorized paired staging QA: open old setup without blocks;
add front top 0/5.2 and independent front lower/rear lower, optional rear top;
save/detail/reopen, title-only save/reopen, dot/comma/fine decimals, both zeros
and partial unknown values; remove one block/clear one position, check retained
siblings and old measurements. Block negative/malformed values with clear errors
and no writes. Check 375px/desktop overflow, label/input/action overlap, fixed
save/nav reachability and physical mobile decimal keyboard/actual paste.
Record the explicit compatible BE/FE SHA pair; mocked HTTP is not live QA.

## Setup photo regressions (Issue #11)

Photos.test.tsx covers create once before uploads, partial success, per-file retry
with stable request UUIDs/no repeated completed upload, queued removal/no DELETE,
optional rejected selection saving, stored+queued capacity/no silent drop, size
hints, immediate cover/delete/fallback/final state, scoped cache invalidation and
preserved unsaved decimals/arm spacing, server 400/409/503/500 and pending duplicate
suppression, non-owner UI, stale mutation reload, media 401/404, session-identity
queue discard and access-loss object URL cleanup. Viewer tests cover Close/Escape,
previous/next, contained focus and opener restoration; jsdom shims only native
dialog/object URL boundaries.

Node-environment api.test.ts validates actual multipart file bytes/filename/type,
request UUID and cookie credentials through RTL-independent MSW HTTP boundary.
jsdom File cannot be encoded as real bytes by Undici; UI queue tests inspect UUID
wire fields, and native Node plus Chromium cover the true multipart path.
PhotosLists.test.tsx covers cover/placeholder/broken media in Home/My/profile,
lazy/aspect slot, no per-card metadata requests and thumbnail session expiry.
All existing numeric/arm spacing/friendship/privacy/cache tests remain required.

Playwright 1.62.1 is pinned for a targeted feature browser gate, not a broad
Phase-8 rollout. npm run test:photos:browser starts local Vite and intercepts only
mock backend HTTP; runs at 375px and 1280px. Check strict placeholder decode,
automated file picker, save-once/partial retry, gallery modal keyboard/focus,
unsaved fields across cover mutation, all list covers, cover/final deletion and
no horizontal overflow. It asserts browser-managed cookie transmission. CI
photo-browser installs Chromium; local browser prerequisites may be unavailable.
These are mocked HTTP/file-picker automation, not physical iPhone, raw HEIC decode,
Google login, live database/service or OS clipboard QA.

Placeholder repair: supplied immutable PNG was flagged as undecodable in Issue
#11 and is never shipped/silently tolerated. Built-in image generation produced a
valid equivalent, visually inspected and fully decoded with Pillow; optimized
600x400 WebP, 7,882 bytes. Generation prompt: extremely minimalist monochrome
studio photograph of one small RC drift model car, centered three-quarter view,
light neutral grey seamless background, generous negative space, no text/logos,
watermark, people or props. Full PNG is not bundled; the optimized asset is local
and requires no external image-generation runtime. Browser verifies its decode.

Node 24 gates: npm ci; npm run api:generate; npm run format:check; npm run lint;
npm run typecheck; npm test -- --run; npm run build; regenerate committed types
again with no diff, and compare exact backend contract bytes. Browser gate also
required for this PR. Paired live QA after separately authorized deployment:
legacy setup, one/ten/eleven files, first/change/delete/final covers everywhere,
interrupt/retry without duplicate setup/photo, real iPhone HEIC/rotated picture,
public/friends/private and known full/thumbnail URLs/unfriend, technical edits,
delete, persistence/restart and coherent backup/restore. Check real phone picker,
keyboard, actual clipboard, 375px/desktop viewer/actions/focus/errors/placeholder.

## Photo UX foundation verification (Issue #13, stage 1)

PhotoToolbar.test.tsx covers hover/focus/tap, Escape/Close/outside/focus departure,
focus restoration, unique hidden inputs, native-input activation, multi-select,
non-submit controls and visible capacity. Photos.test.tsx checks edit toolbar
ordering and preserved unsaved title alongside existing save-once/idempotency,
failed/queued/ten-photo and decimal/spacing regressions.

The reproducible photo browser gate now checks create/edit toolbar order,
hover/focus/click dismissal and overflow at 375px/1280px, and opens the real
browser filechooser through the paperclip rather than setting the input directly.
Mocked HTTP only; this is not physical iPhone or live backend QA. Crop and the
full width/orientation matrix are covered by the v2 checks below. See photo-ux-roadmap.md.

## Photo UX v2 editor and responsive QA (Issue #13, stages 3–4)

crop.test.ts covers integer bounds, centered odd offsets, zoom and clamping for
3:4/9:16 portrait, square, 4:3/16:9 landscape and tiny images. CropEditor.test.tsx
covers cookie/no-store normalized source, cancellation/no writes, focus restoration,
object URL cleanup, exact Apply and null Reset requests, reopened persisted frame,
unsaved title preservation, stale revision explicit reload and bounded explicit
retry. PhotosLists.test.tsx checks same-ID revision reload/broken-image recovery on
Home/My/profile without gallery metadata lookups. Existing upload/cover/delete/
privacy/session/cancelled-query/decimal/spacing tests remain mandatory.

Browser gate now runs 320/375/390/768/1280 plus 640x360 short landscape. It exercises
native chooser, opaque local HEIC selection with mocked normalized JPEG, create
once/partial retry, editor mouse and CDP touch emulation, arrows/sliders, saved frame
versus preview integer coordinates, same-ID blob refresh, failed apply retention/
retry, reload/re-edit/cancel/focus, all six shape fixtures, long/unbroken titles,
zero-photo placeholder, 500 fallback and 404 unavailable, bounded square covers,
all list projections/no metadata N+1, gallery modal focus and cover/final deletion.
Mock thumbnail JPEGs use browser canvas, not production ImageMagick. Interior colors
allow 64/255 channel tolerance; tiny validates geometry only. Normalized fixture
provenance is in scripts/fixtures/photo-shapes/README.md. CI uploads after screenshots
as photo-qa-screenshots. Baseline before screenshots were not captured.

Local Chromium unavailable (truncated download); GitHub photo-browser supplies
reproducible emulated Chromium evidence on exact PR heads. Stage 3 CI run
38298547952 passed on 525b57b5476869a6ada4491828a7bf3cd6c884c4; final matrix evidence
belongs in PR #14. Physical iOS/Android picker/touch/raw HEIC/EXIF and paired live
privacy/reload/races/actual server resampling remain pending; no mocked result is
claimed as live/physical QA. Backend PR #11 CI owns DB/checksum/native decoder tests.

## Owned list view regression (Issue #15)

MySetupsPage navigation tests open title/placeholder links into read-only technical
detail/gallery, then use explicit Edit to hydrate the existing editor without
writes. PhotosLists asserts real cover/placeholder hrefs. Detail tests cover direct
owner public/friends/private reads and permitted non-owner public/friends detail
without mutation UI. The existing direct foreign-edit test also rejects the photo
manager and checks no gallery/mutation requests. Existing 401/unavailable, independent
Edit/Delete cancellation/confirmation and invalid-route regressions remain required.
The existing browser gate adds placeholder/cover/title navigation, reload→Edit,
keyboard cover/title/Edit/Delete order, Delete cancellation, square link bounds,
long titles, foreign detail/direct edit and no writes across the responsive matrix
(including 375px/1280px). HTTP is mocked; physical-device/live backend QA is separate.
