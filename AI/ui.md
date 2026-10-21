# UI and route rules

Mobile-first for use at a drift track: readable numbers, shallow navigation, clear
visibility, comfortable touch targets and no hover-only core action. [Product](product.md)
owns enduring client behavior; [API](api.md) owns transport/caches, not this route map.

## Routes

| Route | Interaction |
| --- | --- |
| /login | Google browser-navigation CTA; authenticated users enter app |
| / | Authenticated public discovery: explicit text search, URL filters, newest-first cursor load-more |
| /setups/:setupId | Stable read-only technical detail/gallery/share; owner-only separate Edit link |
| /my/setups | Own list: sibling title/cover view links, separate Edit/Delete, create CTA and visibility |
| /my/setups/new | Save setup once, then optional photo uploads |
| /my/setups/:setupId/edit | Owner editor, generic unavailable for foreign/unsupported setup |
| /friends | Find people, Incoming Accept/Reject, Outgoing Cancel, accepted Remove with confirmation |
| /users/:userId | Safe nickname/avatar, loaded friendship action, backend-returned visible setups |
| /settings | Nickname editing, current-user email read-only, optional avatar, shell logout |

Discovery clears model when brand changes. All brands/models differ from Custom
setup selection; no Custom filter. Invalid URL filters offer Reset without requests;
load-more retains cards with independent retry. Detail shows historical chassis and
present technical values including zero; missing/private/friendship-denied look alike.
Copy link has success feedback or selectable fallback. Profile/list/friendship load/
error states remain independent; no hidden counts or email/provider identity.

## Forms and numeric interaction

Photos toolbar precedes General. Keep setup sections open with anchor navigation:
General/title/chassis/visibility/notes; front/rear suspension/links; front/rear shocks/
springs/oil; electronics. One logical document, one mobile Save/Create bar above fixed
navigation, inline desktop actions. Reserve padding so final controls stay reachable.

Use text inputs with inputMode=decimal for suspension; do not rewrite while typing,
force integer steps or round precision. Signed angles, positive links/oil and
nonnegative optional spacing retain separate rules. Associated errors and first-invalid
focus work for malformed/nonfinite/nonpositive input. Arm fieldsets identify axle/arm
and ahead/behind spacers in mm with left/right symmetry; removal clears values/errors,
re-add is blank, partial/all-zero detail is retained. See [product](product.md).

## State, identity and accessibility

Every data route has loading, retryable error, session expiry, relevant unavailable,
empty, mutation pending/error and successful destructive states. No raw JSON/server
pages or success-looking permission placeholders. Semantic real buttons/links, labels,
keyboard operation, visible focus and non-color-only status are required.

Public identity links and action buttons are separate, not nested interactive cards.
Avatar/nickname align on the left, bounded friendship action on right; long names wrap.
Below 360px actions occupy a separate right-aligned row; missing avatars reserve no
empty slot. Loaded friendship buckets drive Add friend / incoming Accept friendship /
outgoing Request sent / Friends; own identity has no CTA, failed list blocks action.
Pending disables duplicates across surfaces; stale responses refresh safely.

Inline destructive confirmations focus Cancel and restore the initiating action on
cancel. Modal dialogs contain focus, close with explicit Close/Escape and restore the
opener; short screens scroll within the dialog. Native focus/Escape needs browser QA,
not only jsdom shims. Owner view navigation performs no setup/photo mutation.

## Responsive shell and social links

Below 768px keep fixed Home/My setups/Friends/Settings bottom navigation and account
menu/avatar in header. The modal drawer puts avatar/nickname at top, future navigation
space in middle, canonical social icons then Sign out at bottom. Focus Close on open;
keep outside navigation inert; desktop resize dismisses; scroll/safe areas remain usable.
At desktop retain compact header identity/Sign out and add the social footer.

Canonical URLs live in src/shared/social/profiles.ts; links have accessible names,
new-tab opener isolation and no tracking parameters. Active nav has current-page
semantics plus underline/border. Logout preserves pending/error/retry behavior.

## Photos and crop editor

Paperclip activates a uniquely identified native multi-file picker. Formats, byte/
count limits and conversion/persistence help live in an info popover usable by hover,
focus or tap; keep it hoverable, wrapped and scrollable. Escape/Close/outside pointer/
focus departure dismiss; Escape/Close returns trigger focus. Count/remaining capacity,
queue progress/errors/retry/removal stay visible outside help. Controls do not submit
setup. Photo refresh must not remount/reset the technical form.

Queued local removal differs from confirmed saved DELETE. HEIF local preview may be
unavailable; explain server conversion. New setup retains its returned ID/queue/results
for continuing edit; leaving loses only unsent local selections. Immediate persisted
photo changes are not undone by leaving edit. Detail gallery is read-only.

All thumbnail slots are square. Mobile Home/My/profile cards use 88px squares beside
wrapping metadata/actions; at >=768px grid cards are <=360px, covers <=300px. The
existing 600x400 monochrome WebP is center-fitted, FE-only, not an uploaded photo.
No photo/decode/server failure can use fallback; permission/session failure instead
shows unavailable. Full viewer keeps natural aspect/contain fitting, Close/Escape,
previous/next, focus containment and restoration. Covers lazy-load without metadata N+1.

Crop editor always previews authorized normalized full JPEG. Drag/touch pans, arrows
move one pixel (Shift ten), zoom adjusts integer size; horizontal/vertical sliders are
alternatives. Clamp frame to full bounds. Apply/Reset save immediately; Cancel/Escape
sends no mutation and restores trigger focus. Upload may offer editor without blocking
subsequent queue items. Pending writes suppress duplicates and delay dismissal until
outcome; retry is explicit, 409 requires Reload crop/discard draft, 404 disables Apply.
Revisions refresh thumbnails and joined covers; never destructively crop full photos.
No captions, manual sorting, new permissions or original-image editing by assumption.
