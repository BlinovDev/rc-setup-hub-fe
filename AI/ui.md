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

Authenticated navigation is Home/My setups/Friends/Settings. Find people uses an explicit labeled nickname form. Incoming has Accept/Reject, outgoing has Cancel request, and accepted has Remove friend with inline keyboard-accessible confirmation. Public identities show nickname/avatar without email, with profile links separate from action buttons. Search results show Incoming request / Request sent / Friends or Add friend based on the loaded friendship buckets.

List failure blocks relationship actions instead of appearing empty. List/search loading, retryable errors and empty sections are explicit. Mutation errors are safe, and pending controls are disabled per relationship across both list/search renderings. Stale 404/409 refreshes list state. User-profile navigation is implemented in Phase 6.

## Implemented profiles (Phase 6)

The authenticated `/users/:userId` route shows nickname/avatar, then a visible-setup list with title, historical chassis, returned visibility, update timestamp and detail link. Own profile URLs use the same route. No email, hidden counts, friendship inference or inline friend actions. Invalid/missing profiles are generic unavailable; profile and list loading/errors are independent. Discovery/detail/friendship/search identities use reusable user links with actions outside the link.
