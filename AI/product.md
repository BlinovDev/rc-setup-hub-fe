# Product and business rules

This document is the compact current product truth for agents starting from a fresh chat or task. It describes user-visible behavior and invariants, not implementation history. When behavior changes, update this file in the same PR.

## Product

RC Setup Hub is a web application for RC drift drivers to store, find, and share car setups. The POC targets a local drift community but should remain usable by a wider community without adding unrelated RC disciplines.

The user-facing application is a React frontend backed by a Go JSON API and PostgreSQL. Google is the only authentication provider. The backend also owns a small server-rendered admin area.

## Users and authentication

- A Google identity maps to one application user by stable Google subject.
- An application user has an email, unique nickname and optional avatar.
- Browser authentication is a backend-owned HttpOnly session cookie.
- Frontend JavaScript never stores Google tokens or application session tokens.
- Successful login returns the browser to the trusted configured frontend URL.

## Chassis catalog

- Chassis brands and models are managed by admins.
- Regular users can select active catalog entries but cannot create catalog entries.
- A setup may have no chassis model. This represents Custom/unlisted/unspecified and is not a synthetic database catalog row.
- Existing setups retain historical chassis display data even when catalog entries become inactive.

## Setups

Authenticated users can create, read, update and delete their own setups.

A setup contains:
- title;
- owner;
- optional chassis model;
- visibility;
- structured technical data;
- optional notes;
- schema version;
- timestamps.

Technical data schema v1 covers suspension, shocks/springs and electronics. Optional numeric values preserve the distinction between omitted and explicit zero.

Front/rear suspension angles and link lengths accept a dot or comma decimal separator in create/edit forms. They are sent as JSON numbers without forced rounding or a fixed decimal-place limit; detail and reopened edit preserve the returned values. A single comma is a decimal separator, never a thousands separator; mixed/repeated separators and non-finite values are invalid. Angles may be negative or zero and blank means unknown; each existing link row requires a finite length greater than zero. Shock-oil input rules are unchanged.

Only the owner may modify or delete a setup.

## Visibility

Visibility values are:
- `public`;
- `friends`;
- `private`.

Access rules:
- owner: can read all own setups;
- accepted friend: can read another user's public and friends setups;
- other authenticated user: can read another user's public setups only;
- pending friendship does not grant friends visibility;
- removing an accepted friendship removes friends-only access immediately;
- inaccessible setup detail must not reveal whether the setup exists or is private.

Public discovery/search returns public setups only. User profile setup lists are filtered by backend authorization for the current viewer.

## Friendships

- Users find other users by nickname, not email.
- A friendship starts as a pending request.
- Only the addressee can accept it.
- Requester can cancel; addressee can reject; either participant can remove an accepted friendship.
- There can be only one relationship for an unordered pair of users.
- A user cannot friend themselves.
- Other-user profiles and nickname-search results offer Add friend when unrelated, Accept friendship for an incoming request, Request sent for an outgoing request, and Friends for an accepted relationship. Own identities have no friendship action.
- Relationship actions wait for successfully loaded backend friendship buckets; loading/errors do not imply no relationship. Accepting refreshes the affected visible setup list.

## Public profiles

Direct user profiles expose safe public identity only: application user ID, nickname and optional avatar. Email and Google/provider identity are not public profile data.

## Admin

Admin UI is part of the Go backend, not the React SPA.

Admin authorization comes from the configured email allowlist, not a database role. Admin functionality includes chassis catalog management and minimal operational user/statistics views.

## Deliberate non-goals unless explicitly requested

Do not add by assumption:
- comments, likes, ratings or favorites;
- chat or notifications;
- arbitrary attachments beyond approved optional setup photos;
- setup version history;
- teams/groups;
- multiple RC disciplines;
- user-created chassis catalog entries;
- normalized electronics/shock catalogs;
- native-mobile-specific backend behavior;
- offline synchronization.

## Cross-repository contract

The backend OpenAPI document is the machine-readable API contract. The frontend keeps a committed copy and generates transport types from it.

When a feature changes the API:
1. backend implementation, tests and OpenAPI change together;
2. frontend copies the updated OpenAPI contract;
3. generated frontend types are regenerated;
4. frontend behavior and tests are updated.

Do not make frontend and backend infer incompatible versions of a contract.

## Social profiles and account navigation

Authenticated desktop pages retain the existing header identity and sign-out controls and add a footer with YouTube, TikTok and Instagram icon links. Social links use canonical profile URLs without tracking parameters, have accessible names, and open in a new tab with opener isolation.

On mobile, the closed header shows the optional avatar and an account menu button. The account drawer shows avatar/nickname at the top, reserves the middle for future navigation, and places social links followed by Sign out at the bottom. Existing Home/My setups/Friends/Settings bottom navigation stays in place. The modal drawer supports explicit close, Escape, keyboard focus containment and return to the opener; sign-out pending/error/retry behavior remains unchanged.

## Optional arm spacer totals (Issue #9)

Front/rear suspension each independently offer optional top and lower arm
spacing. No blocks or numeric defaults are present on new/legacy forms. Drivers
add/remove at most one block per arm/axle and record total spacer thickness ahead
of/behind the arm in vehicle direction, symmetric across left/right. No shim
calculator, chassis defaults or asymmetric fields are added.

Blank means unknown; either position may be known independently. Finite
nonnegative dot/comma values are sent as JSON numbers without rounding; explicit
zero survives save/detail/edit. Both blank values omit the block and otherwise
empty parents. Removing/clearing preserves sibling blocks and other technical
measurements; title-only edits preserve all recorded totals. Detail identifies
axle, arm and ahead/behind position, showing mm only for recorded values.

## Optional setup photos (Issue #11, setup-photos-v1)

Setups can have 0–10 optional photos, separate from technical schema-v1 data.
Create saves the setup once before uploading queued files against its returned
ID. Upload failures retain that setup and completed photos; per-file retry reuses
the same UUID/bytes. Queue removal sends no DELETE. Optional rejected selections
never block an otherwise valid setup save. Stored+queued capacity is explained
and over-limit selections are rejected in full without silently dropping files.

On owner edit pages uploads/cover/delete save immediately; text/technical fields
use Save setup independently. Photo refresh never resets unsaved form values.
Leaving edit does not undo persisted photo changes; remaining local queue is lost.
First upload/cover choice/delete-cover oldest fallback/final no-cover are owned by
the backend. No captions or ordering UI. JPEG/JPG, PNG, WebP and HEIC/HEIF hints,
25 MiB and 50 MP server limits; backend converts the first still frame, normalizes
orientation, strips metadata and returns JPEG full/thumbnail output. No claim of
all-format support, no raw public originals, no tokens in links or storage.

Home, My setups and visible-user cards use joined cover thumbnails. Zero photos
and decode/server-load failures use a bundled monochrome model placeholder;
401/403/404 media reads instead show session/unavailable states. Placeholder is
not an uploaded photo and never counts toward the limit. Detail has a responsive
gallery and enlarged viewer with Close/Escape, contained focus/restoration and
previous/next. Current backend visibility remains authoritative on every read.
