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
- links to setup detail and owner profile.

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

One screen may contain tabs/sections for:

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

Implemented in Phase 2 with Home/Settings navigation. The reusable active chassis selector remains a component for the future setup form; no setup route is implemented yet.

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
