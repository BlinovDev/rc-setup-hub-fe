# UI and route rules

Mobile-first for use at a drift track: readable numbers, shallow navigation, clear
visibility, comfortable touch targets and no hover-only core action. [Product](product.md)
owns enduring client behavior; [API](api.md) owns transport/caches, not this route map.

## Routes

| Route | Interaction |
| --- | --- |
| / | Public Explore for guests and signed-in users: explicit text search, URL filters, newest-first cursor load-more |
| /setups/:setupId | Stable read-only technical detail/gallery/share; owner-only separate Edit link |
| /my/setups | Own list: sibling title/cover view links, separate Edit/Delete, create CTA and visibility |
| /my/setups/new | Save setup once, then optional photo uploads |
| /my/setups/:setupId/edit | Owner editor, generic unavailable for foreign/unsupported setup |
| /friends | Find people, Incoming Accept/Reject, Outgoing Cancel, accepted Remove with confirmation |
| /users/:userId | Safe nickname/avatar and paginated public setups; signed-in users can explicitly select Setups visible to you |
| /settings | Nickname editing, current-user email read-only, optional avatar, shell logout |

Discovery clears model when brand changes. All brands/models differ from Custom
setup selection; no Custom filter. Invalid URL filters offer Reset without requests;
load-more retains cards with independent retry. Detail shows historical chassis and
present technical values including zero; missing/private/friendship-denied look alike.
Copy link has success feedback or selectable fallback. Profile/list/friendship load/
error states remain independent; no hidden counts or email/provider identity.

Guests have a global header Sign in action and explicit CTAs at protected routes,
setup creation and friendship actions. No automatic OAuth navigation. Public pages
wait for session resolution; 401 is guest, other session failures offer retry.
Viewer changes remount content/metadata and discard old queues/dialogs/blob URLs.
Guest profile URLs ignore the authenticated `view=visible` mode; public is always
the default. Visible-to-you lists remain an explicit authenticated mode, never
mixed into public discovery or public profile results.

## Forms and numeric interaction

Create retains its existing photo-first flow, essentials, optional Add rows and
six sections. Edit opens directly in **General**. Its six-section navigator precedes
content; General contains photos, required Title, chassis selection, notes and
visibility, in that order, without duplicate essentials above navigation. Other
sections hide General without unmounting fields or the photo manager. Keep photo
writes/queues independent of technical Save and outside its disabled fieldset.
Automatic photo crop dialogs render outside hidden General and retain their state
owner; dismissal restores a visible opener or the current section heading.

Desktop keeps a sidebar from 768px. Mobile Edit uses one distinct sticky
current-section button above all content,
with a small Section caption, blue-tinted surface/border, side spacing and a 12px
gap below the safe top edge. Its geometric chevron stays vertically centered;
the non-sticky app header scrolls away. It opens the native modal bottom
sheet with current location/error counts. Selection focuses the section heading;
Escape/dismissal restores the trigger. Keep focused controls below the picker and
above fixed Save/site navigation; compact Save padding must retain 44px controls.

Existing configured Edit components are compact, vertical label–value summaries,
including zero, partial/historical/manufacturer-only values and wrapped long text.
The whole preview is a native keyboard-accessible edit target with visible focus
and an edit hint. A separate 44px corner trash control has a specific accessible
Remove name; it never opens the editor. Populated removal confirms with Cancel
focused, clears only that component and re-add starts blank. Close editor retains
all drafts without validation/deletion; Done validates that component and retains/
focuses invalid fields, otherwise closes. Save persists the full document.

Each technical Edit section has one low-emphasis **+ Add component** chooser listing
only absent parts with axle context. The same native button toggles its associated
panel (aria-expanded/aria-controls); the panel contains only named component choices,
never a dismiss row. Escape closes it and restores trigger focus. Keep 44px choice
targets with subtle hover/focus treatment. Section headings and existing inputs/cards
precede this secondary disclosure, with no bulk-delete control or reserved gap.
Adding an empty component keeps its editor
available through Close/section switches; only explicit removal returns it to the
chooser. Optional editors stay hidden until added/edited/revealed by validation.
No nested accordions or per-part oversized Add/Edit/Remove buttons. Presentation
state never determines serialization. Mounted hidden editors preserve registrations,
stable field-array IDs, incomplete numeric text and manufacturer cancel state.

Keep optional axle geometry visible within Front/Rear and shock basics before
piston/seal controls. Use two columns only for short related fields and full-width
notes. Submission validates all sections, exposes a linked error overview/counts,
reveals hidden fields and focuses real controls after commit, including chassis and
aggregate link errors. Resizing and section navigation retain drafts/errors.

General is the top-level edit view and the only section with **Delete setup**.
There are no section-wide Clear actions, overflow substitutes or bulk-delete
controls. Users can edit individual fields or explicitly remove an optional component
with the existing confirmation. These actions retain unrelated sections/errors and
photos; backend deletion APIs and other deletion flows are unchanged.

Guard exit/unload for unsaved setup fields and queued files. Already-persisted photo
changes are retained. Successful edit Save resets the dirty baseline and replaces
the editor history entry with read-only detail. Validation/API/409 errors stay in
edit. Queued files still require exit confirmation; cancelling retains original bytes
and the saved form baseline. Explicit conflict reload remains the discard/remount
boundary and returns to General. No change to read-only detail or other deletion flows.

Use text inputs with inputMode=decimal for suspension; do not rewrite while typing,
force integer steps or round precision. Signed angles, positive links/oil and
nonnegative optional spacing retain separate rules. Associated errors and first-invalid
focus work for malformed/nonfinite/nonpositive input. Arm fieldsets identify axle/arm
and ahead/behind spacers in mm with left/right symmetry; removal clears values/errors,
re-add is blank, partial/all-zero detail is retained. See [product](product.md).

Rear differential fields are independent and optional: type, catalog manufacturer,
model and multiline tuning notes. Confirmed removal removes the block without resetting other
fields. Reuse the cached chassis-brand catalog; existing manufacturer selection
loads only on explicit Change, supports retry/cancel, and retains the historical
name/reference when inactive. Detail is read-only and uses the returned name
projection, with an unavailable-name fallback and no extra catalog lookup.

Each suspension axle has one optional lower arm mount description: catalog
manufacturer, model/part number and multiline configuration notes. Fields are
independent; removal affects only that axle's mount. Reuse the component manufacturer
selector, retaining historical references with lazy edit loading and retry/cancel.
Detail uses the joined per-axle name projection without catalog requests. No separate
mounts, inserts or geometry controls.
Front steering knuckles use independent optional catalog manufacturer and free-text
part number/description (200 Unicode characters). Removal affects only the knuckle.
The shared component manufacturer selector retains historical references, loads
active choices on explicit Change in edit, and supports retry/cancel. Read-only
detail uses the joined name projection without additional catalog requests.

Each axle has optional hex, wheel and tire fieldsets. Hex offset accepts signed
dot/comma decimals without rewriting while typing; wheel offset accepts signed
int32 whole millimetres. Their offsets are independent and zero is preserved.
Wheel/tire manufacturer and model are independently optional; reuse the shared
manufacturer selector and joined historical displays. Removal affects only that
component. Empty blocks/parents are omitted; no hex width or calculated offsets.

Each axle's shock section includes independent optional piston hole count, diameter
(mm), multiline notes, seal type and product description. Removal of piston/seal affects
only that block. Counts are positive int32 integers; diameters accept dot/comma
without rounding or rewriting while typing. Blank fields stay unknown; detail shows
only present values. Existing shock manufacturer/model controls remain unchanged.

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

Below 768px keep a single-row header: branding and Sign in for guests, existing
avatar/account menu for members. The fixed bottom row has exactly three actions:
guests see Explore, My setups, Help & Feedback; members see Explore, My setups,
Friends. My setups always links to /my/setups; guests see the existing explicit
Google sign-in UI there, with no private list request, empty-list substitute or
automatic OAuth redirect. Login/logout update navigation with the session boundary.

The member drawer contains Account settings (the unchanged /settings route) and
Help & Feedback, followed by canonical social icons and Sign out. Selecting Account
settings closes the drawer. Focus Close on open; outside navigation stays inert;
closing nested Help restores its trigger and leaves the drawer open. Desktop resize
dismisses the drawer. Reserve safe-area padding below the bar and above fixed Save
controls; viewport-fit=cover enables iOS insets, with branding below the top inset.
Desktop navigation, identity, Sign out and social footer remain unchanged.

Help & Feedback is the guest bottom-bar action, member drawer action and quiet
desktop-footer action.
Its compact native dialog shows selectable support email, mailto, Close/Escape,
backdrop dismissal and contained/restored focus. Feature copy is centralized under
src/features/help for later translation; no response-time or account-creation promise.

Canonical URLs live in src/shared/social/profiles.ts; links have accessible names,
new-tab opener isolation and no tracking parameters. Active nav has current-page
semantics plus underline/border. Logout preserves pending/error/retry behavior.

## Photos and crop editor

Paperclip activates a uniquely identified native multi-file picker. Formats, byte/
count limits and conversion/persistence help live in an inline panel usable by hover,
focus or tap. It expands in document flow without covering essentials; keep it
hoverable, wrapped and scrollable. Escape/Close/outside pointer/
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
