---
name: "rc-blast-radius"
description: "Analyze what a proposed change or diff can break beyond its immediate callers. Read-only impact analysis with explicit evidence and unproven assumptions."
license: "MIT"
---

# Blast-radius analysis

Read applicable AGENTS.md and relevant AI architecture, API, decisions and testing docs.
Establish the exact diff/base or proposed change before reasoning about impact. Trace callers
and consumers, then cross boundaries that symbol search misses: persisted representations,
wire formats, caches, lifecycle ordering, cleanup, generated contracts and paired releases.
Do not assume another repository is checked out or authorized for inspection.

Find the one or two facts on which safety depends. For each, distinguish an assertion,
source evidence, a traced counterexample, executable evidence and live QA. Run an existing
focused check only when it uses disposable local resources and is allowed; otherwise name
the proof still needed. Grep and a convincing explanation alone are not runtime proof.
Do not execute live services or mutate production/staging to obtain stronger evidence.

Frontend focus: use this repository's api/openapi.yaml and generated transport types;
do not inspect Go source or another checkout unless explicitly requested. Preserve the shared
credentialed API client, backend-owned auth/authorization, TanStack Query ownership/invalidation,
feature modules, zero versus omitted numeric values, responsive accessibility and photo lifecycle.
Use Vitest/RTL/MSW boundaries and the documented browser gate where required. Mocked HTTP and
emulated Chromium do not establish real OAuth, physical phone/HEIC or paired live QA correctness.

Return changed behavior, confirmed downstream risks with trigger/impact/file evidence,
checked-and-cleared paths and unproven safety assumptions with the smallest useful checks.
Read-only: do not edit source, tests, fixtures or commit an experimental script. Do not
invent callers or numerical likelihoods. No automatic fix, merge, deployment or broad refactor.

Adapted sources, revisions and licenses: [engineering skills](../../../AI/engineering-skills.md) (pstack).
