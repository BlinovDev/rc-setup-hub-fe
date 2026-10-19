---
name: "rc-review"
description: "Independently review a diff for concrete correctness, security, regression, and maintainability issues. Read-only review; does not fix or approve merging."
license: "MIT"
---

# Independent engineering review

Read applicable AGENTS.md and relevant AI decisions, architecture and testing requirements.
Resolve the exact review scope and base/head revisions. Read the diff, surrounding flow,
callers and tests independently of the implementer's explanation. Existing design decisions
are constraints, not permission to redesign. An implementer's self-check must be labeled as
such; use a fresh review session when independent evidence is needed.

Challenge input validation, authentication/authorization, data integrity, concurrency,
error handling, lifecycle/cache behavior and test adequacy before aesthetic concerns.
Check upstream-inspired simplifications against the project's actual scale and requirements.
For every finding, verify a reachable trigger and observable impact in the current code.
Separate introduced regressions from pre-existing debt, confirmed findings from questions,
and necessary fixes from optional structural suggestions. Never invent a finding quota.

Frontend focus: use this repository's api/openapi.yaml and generated transport types;
do not inspect Go source or another checkout unless explicitly requested. Preserve the shared
credentialed API client, backend-owned auth/authorization, TanStack Query ownership/invalidation,
feature modules, zero versus omitted numeric values, responsive accessibility and photo lifecycle.
Use Vitest/RTL/MSW boundaries and the documented browser gate where required. Mocked HTTP and
emulated Chromium do not establish real OAuth, physical phone/HEIC or paired live QA correctness.

Return highest-impact findings first with severity, precise file/line, trigger, impact,
evidence and the smallest suitable remedy. Include executed checks and missing evidence.
If none are confirmed, say so with residual risks; that is not proof of correctness or approval.
Read-only: no edits, automatic fixes, commits, PR approval, remote review comments, merges,
deployments or broad refactoring. Do not imply independent models ran; no orchestration is assumed.

Adapted sources, revisions and licenses: [engineering skills](../../../AI/engineering-skills.md) (pstack).
