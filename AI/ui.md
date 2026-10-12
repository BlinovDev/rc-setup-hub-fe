# UI and route direction

## Product feel

The POC should feel useful at a drift track on a phone first, while remaining comfortable on desktop.

Priorities:

- fast to scan;
- easy to edit with one hand;
- readable numeric values;
- clear visibility state;
- minimal navigation depth;
- no decorative complexity that slows down POC iteration.

## Initial route map

```text
/login
/
/setups/:setupId

/my/setups
/my/setups/new
/my/setups/:setupId/edit

/friends
/users/:userId
/settings
```

Suggested meaning:

### `/login`

- Google sign-in CTA;
- brief product explanation;
- redirect authenticated users into the app.

### `/`

Public setup discovery/search.

- text search;
- brand/model filters;
- newest-first results;
- cursor pagination/load-more;
- links to setup detail and safe public owner identity; owner identities link to profiles (Phase 6).

### `/setups/:setupId`

Stable shareable setup detail route.

The backend decides whether the current user may read it.

### `/my/setups`

- owned setup list;
- create CTA;
- edit/delete actions;
- visibility indicator.

### `/my/setups/new`

Create setup form.

### `/my/setups/:setupId/edit`

Edit owned setup.

### `/friends`

Implemented in Phase 5 with sections for:

- accepted friends;
- incoming requests;
- outgoing requests;
- nickname search/add friend.

### `/users/:userId`

Display the target user's visible setups.

Do not infer friendship/private state beyond what the backend returns.

### `/settings`

POC profile settings:

- nickname display and edit form;
- email (read-only, current user only);
- current avatar if available;
- logout through the shared authenticated shell.

Implemented in Phase 2. Phase 3 adds Home/My setups/Settings navigation and the owned setup list/create/edit routes. The active chassis selector is reused for new selections; edit preserves the historical chassis until Change chassis is explicitly chosen. Phase 4 now implements authenticated public discovery and the stable detail/share route. Phase 6 adds owner identity links to the profile route.

## Setup form sections

Avoid one undifferentiated wall of inputs.

Suggested sections:

```text
General
  title
  chassis brand/model or Custom / not listed
  visibility
  notes

Front suspension
  camber
  caster
  toe
  link lengths

Rear suspension
  camber
  caster
  toe
  link lengths

Front shocks
  manufacturer
  model
  spring manufacturer
  spring color
  oil cSt

Rear shocks
  manufacturer
  model
  spring manufacturer
  spring color
  oil cSt

Electronics
  motor
  ESC
  servo
  gyro
  radio
```

These sections may use accordions/cards/steps visually, but the backend request remains one setup document.

## Visibility UI

Visibility values are exactly:

```text
public
friends
private
```

Use clear human labels and concise explanations.

Do not invent additional visibility states.

## Loading/error/empty states

Every data-driven route should intentionally handle:

- initial loading;
- retryable error;
- 401/session expiry;
- 404/no access where relevant;
- empty result;
- mutation pending state;
- mutation error;
- successful destructive action.

Do not leave raw JSON/server error pages as the normal UI.

## Responsive direction

Mobile-first.

Desktop may use wider cards/tables where useful, but do not make core actions depend on hover.

Touch targets should be comfortable.

## Accessibility baseline

Use semantic controls and labels.

- form fields require accessible labels;
- buttons must be real buttons;
- keyboard navigation must work;
- do not communicate visibility/error state only by color;
- dialogs require focus management if introduced.

## Implemented discovery/detail states (Phase 4)

Discovery submits text explicitly, keeps filters in the URL, and clears model when brand changes. All brands/All models are distinct from Custom setup selection; no Custom filter is offered. Invalid URL filters show a Reset filters action without requests. Load more retains cards and retries additional-page failures independently.

Detail uses historical chassis, safe public owner identity and only present technical values, including zero. Empty and unsupported technical data have explicit messages. Unavailable detail never distinguishes missing/private/friendship cases. Copy link reports success or exposes a selectable fallback URL. Owners have an Edit link; user-profile pages are implemented in Phase 6.

## Implemented friendships (Phase 5)

Authenticated navigation is Home/My setups/Friends/Settings. Find people uses an explicit labeled nickname form. Incoming has Accept/Reject, outgoing has Cancel request, and accepted has Remove friend with inline keyboard-accessible confirmation. Public identities show nickname/avatar without email, with profile links separate from action buttons. Search results show Accept friendship / Request sent / Friends or Add friend based on the loaded friendship buckets. Reject/cancel/remove controls remain in the dedicated relationship sections.

List failure blocks relationship actions instead of appearing empty. List/search loading, retryable errors and empty sections are explicit. Mutation errors are safe, and pending controls are disabled per relationship across both list/search renderings. Stale 404/409 refreshes list state. User-profile navigation is implemented in Phase 6.

## Implemented profiles (Phase 6)

The authenticated `/users/:userId` route shows nickname/avatar, then a visible-setup list with title, historical chassis, returned visibility, update timestamp and detail link. Own profile URLs use the same route. No email, hidden counts or friendship inference from setup visibility. A compact header action uses loaded backend friendship buckets: Add friend / Accept friendship / Request sent / Friends; own profiles have no action. Friendship loading/error/retry is independent of profile and visible setups. Invalid/missing profiles are generic unavailable; profile and list loading/errors are independent. Discovery/detail/friendship/search identities use reusable user links with actions outside the link.

## Implemented responsive UX (Phase 7)

Mobile uses fixed bottom navigation (Home, My setups, Friends, Settings), while desktop uses the compact app header. Active navigation includes an underline/border and accessible current-page state. Desktop identity and Sign out remain compact in the header. On mobile, the closed header shows the optional avatar and an account menu button; nickname and Sign out appear inside the account drawer. Main content reserves space for navigation and safe-area insets.

Setup sections remain open with anchor navigation; one mobile Save/Create bar sits above navigation, with page padding keeping final controls reachable. Desktop actions remain inline. Numeric inputs remain decimal text fields with blank/zero/negative semantics unchanged. Shared native buttons, loading states, inline notices and readable visibility badges unify feedback. Inline destructive confirmations focus Cancel and restore the initiating action on cancellation. Cards, technical definition lists, filters, profile and settings wrap on narrow screens.

Phases 0–6 are complete, including live profile/visibility smoke. Phase 7 implementation and automated verification are complete; live mobile/UX smoke remains pending. Phase 8 is not started.


## Social links and mobile account drawer (Issue #3)

At the existing 768px desktop breakpoint, authenticated pages show a social footer; the desktop header/session UI is unchanged. Below that breakpoint, an accessible burger button opens a native modal dialog. The dialog puts avatar/nickname at the top, an extensible navigation slot in the middle, and social icons then Sign out at the bottom. Canonical URLs live in `src/shared/social/profiles.ts` and are reused by both surfaces.

The dialog focuses Close on opening, contains keyboard focus through native modal behavior, closes with Close or Escape, and returns focus to its opener. Switching to desktop closes it. The drawer scrolls on short screens and respects safe-area insets and the fixed bottom-navigation space. Bottom navigation stays outside the drawer and becomes inert while the modal is open. Sign out uses the existing mutation and retains disabled pending, safe error and retry states.

## Profile and search friendship actions (Issue #5)

Profile headers group avatar before nickname on the left, with a compact action/status on the right. Nickname, avatar and action are vertically centered; the header heading has no bottom margin. Search result identities and controls use the same two-column row. Long nicknames wrap within their own column, the action has a bounded width, and screens below 360px put the action in a separate right-aligned row. Missing avatars do not reserve an empty image slot.

Accept friendship accepts the existing incoming request ID and reuses scoped friendship/detail/visible-user-list invalidation. Add friend sends a pending request. Pending actions disable duplicates, stale 404/409 refresh safely, and session expiry follows the existing authentication boundary. Existing Incoming/Outgoing/Accepted management sections retain Accept/Reject/Cancel request/Remove friend.

## Suspension decimal input (Issue #7)

Create/edit keep suspension measurement inputs as text with `inputMode="decimal"`, accepting dot or comma fractions without rewriting text while typing. Normalization happens only during validation and request serialization. Front/rear camber/caster/toe support signed finite values, including explicit zero; blank angles remain unknown. Dynamic link lengths require a positive finite number. Do not add integer stepping or fixed decimal precision. Detail and edit hydration use the numeric API values without rounding. Existing associated validation errors and first-invalid-field focus apply to malformed or nonpositive inputs.

## Optional arm spacing (Issue #9)

Each Front/Rear suspension fieldset offers Add top arm spacing and Add lower arm
spacing, scoped by axle. Added nested fieldsets identify axle and arm and contain
Front spacers (mm), Rear spacers (mm) and Remove. Labels explicitly include
axle/arm; helper text explains ahead/behind vehicle direction and left/right
symmetry. Only one block per type/axle can exist. Blocks start blank and remain
optional; removal clears registered values/errors and re-add starts blank.

Reuse decimal text inputs, associated errors and first-invalid focus. Blank is
unknown, zero valid, totals finite >=0. Existing signed angles and positive-only
link/oil rules remain intact. Fieldsets/controls wrap within the existing mobile
layout; validate 375px and desktop geometry in browser QA.

Detail shows separate axle/arm headings and Front spacers (ahead of arm) / Rear
spacers (behind arm) with mm. Unknown positions and empty blocks are omitted;
all-zero blocks remain visible. No defaults/calculator/asymmetry are introduced.

## Setup photo UI (Issue #11)

New setup has an optional multi-file picker and distinct local preview queue.
Picker publishes the exact JPEG/PNG/WebP/HEIC/HEIF hint and 25 MiB/ten-photo limits.
Each queued row exposes pending/queued/error/uploaded status, removal before
upload, and explicit retry after failure. HEIC browsers may lack local preview;
explain server conversion. New text/data save happens once; with photos the page
keeps its returned setup ID and queue/results instead of creating again. An edit
link allows continuing with that saved setup. Without photos existing navigation
after create remains unchanged. Remaining local selections are lost on leaving.

Owner edit pages explain immediate photo persistence versus separately saved
setup fields. Cover badge/select and confirmed saved-photo deletion use server
responses; removal of a queued item is a different action. Photo query refresh
does not remount/reset the setup form. Cancellation focuses the restored delete
button. Detail gallery is read-only; non-owner receives no management controls.

All cards reserve 3:2 thumbnail space, lazy load, and use a consistent optimized
600x400 bundled fallback (public/images/setup-photo-placeholder.webp). It is a
verified equivalent generated to replace the corrupt supplied PNG, not a
recovered original or an uploaded photo. Permission/session failures show explicit
unavailable state instead of a success-looking fallback. The enlarged native
dialog supports Close/Escape, previous/next, focus containment/restoration and
mobile/desktop wrapping. No photo captions, manual sorting, crop/editor or new
permissions are introduced.

## Photo toolbar foundation (Issue #13)

The shared Photos toolbar appears after header/back navigation and before General
on create/edit. Paperclip opens a hidden, uniquely identified multi-file input.
The information panel opens on hover/focus/tap, stays hoverable, wraps and scrolls
on short screens, and dismisses with Escape, Close, outside pointer or focus
departure. Escape/Close restores its trigger focus. Count/capacity and actionable
queue/upload failures remain outside the panel. Saved-photo actions follow the
compact toolbar; photo refresh leaves the setup form mounted.

The approved square crop/editor supersedes Issue #11's no-crop and 3:2 direction
once stages 2–4 land. Existing 3:2 frames are still implemented in this foundation.
Do not mark the overall photo UX complete before AI/photo-ux-roadmap.md gates pass.
