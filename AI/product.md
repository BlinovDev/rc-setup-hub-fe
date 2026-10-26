# Frontend enduring rules

Shared business rules have one owner: backend
[product](https://github.com/BlinovDev/rc-setup-hub/blob/main/AI/product.md).
This document owns client behavior only. Transport/cache details live in [API](api.md),
route/interaction details in [UI](ui.md). Use [docs by exception](workflow.md).

## Access and forms

- Explore `/`, public setup detail/gallery and safe public profiles are readable by
  guests. `/me` 401 is an expected guest state; protected routes/actions require sign-in.
  Backend authorization/visibility remains authoritative; controls provide UX only.
- My setups title/cover open read-only shared detail. Owners have a separate Edit
  action; permitted non-owners have no mutation controls and cannot use the editor.
- Active chassis selection includes synthetic Custom/null; preserve an unchanged
  historical inactive reference until the user explicitly changes it.
- Preserve explicit zero versus blank/unknown and precision. Suspension decimal text
  accepts dot/comma without rewriting while typing. Signed finite angles, positive
  link/oil values and nonnegative optional spacing retain their distinct validation.
  Comma support follows the field-specific [UI rules](ui.md); oil syntax is unchanged.
- Optional arm blocks start blank, support partial/all-zero values, removal/re-add,
  and omit empty parents. No mandatory defaults/calculations. Full-data PATCH preserves
  untouched technical values; blank notes clear with null; title-only changes preserve data.
- Friend actions use loaded backend buckets: Add friend / incoming Accept friendship /
  outgoing Request sent / Friends. Own identities have no action. Errors/loading do
  not mean no relationship; accepted changes refresh affected visible lists.

## Photos

- Keep the selected File bytes/name/MIME unchanged. Picker hints are not content
  security. Create saves once before uploads; partial failures retain setup, queue,
  successful files and per-file retry UUID. Removing a local selection sends no DELETE.
- Stored plus queued capacity is explained; reject over-limit selections in full
  without silent drops. Rejected optional photos never block a valid setup save.
- Edit uploads/cover/delete/crop persist immediately, independently of Save setup;
  never reset unsaved technical fields. Leaving edit does not undo persisted changes;
  remaining local selections are lost. Do not introduce captions/manual ordering.
- Use server-normalized JPEG for square framing of every supported input format.
  Apply/reset save; cancel/skip does not write. Full images stay uncropped. Revision
  refresh, conflicts/reload and explicit retry preserve the prior saved frame on failure.
- Joined covers serve Home/My/profile lists without per-card metadata lookup. Use
  the bundled monochrome placeholder for no photo/decode/server failure, but show
  session/unavailable states for permission failures. Placeholder is not a photo.
- Translate known validation reasons safely, keep an unknown-error fallback and
  distinguish HTTP 413. Never display arbitrary server details or store media/tokens.

## Presentation

Mobile-first, accessible keyboard/touch controls and clear loading/error/empty states.
Desktop header identity/sign-out plus social footer; mobile avatar/menu with nickname,
social links then Sign out in the drawer, retaining bottom navigation. Canonical social
URLs have accessible names and opener isolation. See [UI](ui.md) for modal/focus rules.
