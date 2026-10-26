# Frontend verification gates

Use Node 24 from [.nvmrc](../.nvmrc). Tests are colocated: Vitest for parsing/state,
RTL for interactions, MSW at the HTTP boundary. Avoid deep client mocks; unhandled
requests fail tests and handlers reset per test. Automated suites do not perform
real Google OAuth or establish backend/database authorization.

## Commands (repository root)

Docs/instruction-only changes:

```sh
python3 scripts/verify-docs.py
python3 -m unittest discover -s scripts -p 'test_docs.py' -v
python3 scripts/verify-engineering-skills.py
python3 -m unittest discover -s scripts -p 'test_engineering_skills.py' -v
git diff --check
```

Application changes / existing CI test job:

```sh
npm ci
npm run api:generate
git diff --exit-code -- api/openapi.yaml src/api/generated/schema.ts
npm run format:check
npm run lint
npm run typecheck
npm test -- --run
npm run build
```

With intentional contract changes, commit the exact backend contract/generated types,
then regenerate and require no diff. Do not manually format/edit generated files.
Existing PR CI still runs regardless of a documentation-only local check selection.

Photo/responsive/interaction changes also require the existing photo-browser gate:

```sh
npx playwright install --with-deps chromium
npm run test:photos:browser
```

The script starts local Vite and runs independent `lifecycle` and `compact-edit`
scenarios, each with a fresh browser context and explicit backend fixture. Failures
are named by scenario/viewport and collected so later scenarios still run. To
reproduce one suite, use `PHOTO_BROWSER_SCENARIO=compact-edit npm run test:photos:browser`
(or `lifecycle`); the required gate remains the unfiltered command. It uses mock
backend HTTP and checks 320/375/390/768/1280
plus 640x360. It covers chooser/toolbar, save-once/partial retry, gallery/focus,
crop mouse/emulated touch/arrows/sliders, integer preview/frame, all six shapes,
revision/blob refresh, bounded square lists/long titles/placeholder/errors and
owner view/edit navigation without writes. It asserts browser-managed credentials
and no per-card metadata N+1. Shape provenance is in
[fixtures](../scripts/fixtures/photo-shapes/README.md); screenshots are CI artifacts.
Mock thumbnail resampling uses canvas with 64/255 interior-color tolerance; tiny
fixtures check geometry. Keep mock generation in a separate non-navigating renderer,
and drain route handlers before closing contexts. Do not weaken gates to avoid tooling.

## Mandatory regressions

| Area | Required cases |
| --- | --- |
| Auth | 401 clears protected data; failed logout retains user, no stale in-flight restore; no frontend tokens/storage |
| Setup forms | Empty vs zero, signed/finite/positive distinctions, dot/comma suspension typing/paste, dynamic links, precision, legacy/null/empty values, full-data PATCH, unchanged historical chassis, notes clearing |
| Arm spacing | Both axles/arms/positions, partial/all-zero, add/remove/re-add, siblings/title-only preservation and invalid/no-write states |
| Discovery/detail/profile | URL/UUID/filter/cursor validation, no hidden results/client permission inference, no N+1/detail seeding, independent error/empty states, unsupported schema, safe identity and clipboard fallback |
| Friendship/cache | Loaded bucket actions, self/no CTA, duplicate suppression, stale 404/409, accepted-removal cancellation/purge, no late response restoring access; preserve unrelated lists/auth/catalog/search |
| Photos | Original bytes/MIME/name/UUID multipart boundary, create once, partial retry, count/size/format, queued removal vs persisted DELETE, immediate writes preserving form state, cover/fallback, access loss/blob cleanup/session remount |
| Crops | Normalized full JPEG for all formats, integer bounds/odd center, no-write cancel, retry/revision reload, safe failures, focus/URLs, all joined cover revisions and no full-image mutation |
| UI/security | Labeled controls/current navigation, keyboard/focus restoration, pending/error states, no overlap with fixed nav/save/safe areas, long/missing avatars, safe social links and no raw server errors |

jsdom shims native dialog/object URL boundaries only; verify real modal focus/Escape
in browser QA. Node multipart tests use actual File bytes; jsdom File/Undici does
not prove native multipart encoding. Synthetic MIME tests are transport evidence,
not actual HEIF decode. Backend CI owns PostgreSQL/checksum/native codec coverage.
Do not treat mock success as live backend/device proof or use stored auth tokens.

## Separately authorized live QA

Record exact paired BE/FE SHAs and results in the owning PR/Issue, not test-count
appendices. Exercise real login, nickname, setup CRUD/detail/edit/discovery/share,
zero/blank/dot/comma/spacing, historical chassis, friendship/profile access and
unfriend revocation with two accounts. At mobile and desktop verify scrolling,
touch targets, drawer/dialog focus, destructive confirmations, save/nav reachability
and real phone keyboard/OS clipboard behavior separately from emulation.

For affected photos/crops verify original iPhone HEIF/rotated JPEG, actual picker/touch,
server normalization/resampling, one/ten/eleven photos, interruption/retry without
setup/photo duplicates, crop/cover/delete/reload, all lists and private/friends/public
known image URLs. Check persistence across restart and coherent populated DB+media
restore through the backend's host gates when relevant. No mock result is live QA.

Static packaging checks do not prove Codex discovery. Use [context smoke](context-smoke.md)
and [engineering skills](engineering-skills.md) for fresh read-only procedures.
