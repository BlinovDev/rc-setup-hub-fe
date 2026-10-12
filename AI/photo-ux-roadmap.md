# Photo UX v2 roadmap — frontend Issue #13

Feature: `setup-photo-ux-v2`. Backend dependency: [Issue #10](https://github.com/BlinovDev/rc-setup-hub/issues/10).
No merge, deployment or live server change is authorized.

1. **UI foundation:** shared compact toolbar, top create/edit placement, paperclip,
   accessible information panel, visible queue/capacity/errors and unchanged
   save-once/retry/form behavior. Code implemented; gate requires RTL/full checks
   and mocked Chromium at 375px and 1280px. Final evidence is recorded in the PR.
2. **Backend square crop contract:** blocked pending backend implementation PR.
   BE owns coordinate/version semantics, normalized full media, safe thumbnail
   publication, owner/visibility/concurrency/idempotency and PostgreSQL tests.
   Do not claim this gate passed from frontend mocks.
3. **Frontend crop editor:** pending stage 2. Copy exact PR OpenAPI, regenerate
   types, use authenticated normalized full media for every format, touch/keyboard
   pan/zoom, live square preview, Apply/Cancel/Reset and explicit retry. Test
   portrait/square/landscape/tiny fixtures, focus/cancel/failed apply, reload and
   same-ID revision refresh across cover/list projections without N+1 metadata.
4. **Lists/gallery and paired regression QA:** pending stages 2–3. Square bounded
   covers in Home/My/profile/gallery/queue, compact mobile rows and desktop cards,
   existing WebP fallback, full uncropped gallery. Gate: all required CI and
   browser widths 320/375/390/768/1280, long content/no-photo/unavailable/keyboard/
   narrow landscape; exact compatible BE/FE SHA pair. Physical iPhone/rotation/HEIC,
   live privacy/reload/cover/delete/races and checksum preservation remain pending
   unless actually run after separately authorized paired staging deployment.

The old 3:2/no-crop rules are superseded as approved design, but their replacement
is not yet implemented. Keep the PR draft and Issue #13 open until all implementation
and required gates pass. No backend contract SHA pair is available for this foundation.
