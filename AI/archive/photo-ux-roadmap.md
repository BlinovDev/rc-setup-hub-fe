# Photo UX v2 roadmap — frontend Issue #13

Feature: `setup-photo-ux-v2`. [FE PR #14](https://github.com/BlinovDev/rc-setup-hub-fe/pull/14)
links [BE PR #11](https://github.com/BlinovDev/rc-setup-hub/pull/11).
No merge, deployment or live server change is authorized.

1. **UI foundation: complete.** Top create/edit shared paperclip/count/info toolbar;
   RTL/save-once/limits/form preservation and 375px/1280px browser gate passed in
   CI run 38297118100 on FE c56d638a93251c753389d905a89b5a42b94cf568.
2. **Backend square crop contract: available and verified.** Exact BE head
   8c5bc3c67eb9ba87e8b9b6b540d2bc5854095096, contract SHA256
   3b81afb96461c5c4973dad261a17460b231c96a30b30c3706c0746c0fb5ee850.
   Backend CI run 38297690445 passed. Backend owns normalization/checksum/owner/
   visibility/concurrency/storage/PostgreSQL/native decoder evidence.
3. **Frontend crop editor: implemented.** Exact contract copied/types generated;
   normalized source, touch/mouse/keyboard/slider pan/zoom, Apply/Cancel/Reset,
   failed-write retention/exact retry, stale revision reload and media refresh.
   RTL/bounds/full local tests passed; stage-3 CI run 38298547952 passed on
   FE 525b57b5476869a6ada4491828a7bf3cd6c884c4 before phase 4.
4. **List/gallery polish and regression QA: implemented.** Bounded square mobile
   rows/desktop cards, retained WebP, square gallery/queue, uncropped full viewer;
   matrix 320/375/390/768/1280 + short landscape, all six normalized shapes,
   long titles/no-photo/errors/unavailable/focus, same-ID revision reload, crop
   preview match/retry/cancel, cover/delete and no metadata N+1. Exact final
   FE SHA, CI evidence and compatible pair are recorded in PR #14.

Physical iPhone/raw rotated JPEG/HEIC, actual phone keyboard/picker/touch and live
paired privacy/cover/delete/reload/races/real server resampling QA are **pending**.
Run only after separately authorized paired staging deployment. Backend full-image
checksum evidence is automated BE CI, not physical/live FE QA. Do not merge/deploy
or approve production from mock Chromium tests alone.
