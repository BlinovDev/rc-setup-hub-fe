# Frontend delivery and documentation policy

Shared source hierarchy, docs-by-exception, cross-repo specification ownership and
release gates are maintained once in the backend
[delivery policy](https://github.com/BlinovDev/rc-setup-hub/blob/main/AI/workflow.md).
Shared business rules live in backend
[product](https://github.com/BlinovDev/rc-setup-hub/blob/main/AI/product.md);
client-only behavior lives in local [product](product.md) and [UI](ui.md).

For paired unmerged work, read the shared policy/specification at the exact backend
PR head linked by the owning issue, rather than assuming main already contains it.
No sibling checkout, earlier chat or backend source access is required to find rules.

## Local task flow

1. Read the owning Issue/acceptance criteria and [AGENTS](../AGENTS.md) task rows;
   inspect relevant code/tests and [decisions](decisions.md). Resolve conflicts with
   code/contract explicitly; neither code nor an old report silently changes policy.
2. Implement approved scope on a branch. Cross-repo work has one owning spec Issue,
   linked local deltas, and separate linked PRs; backend OpenAPI changes first.
   Copy the exact [contract](../api/openapi.yaml), regenerate/commit types using
   [API guidance](api.md), and record compatibility/order and exact SHA pair in PRs.
3. Run [checks](testing.md) with Node 24 and inspect required CI at the current head.
   Report pending/failed/missing checks and mocked versus physical/live evidence.
4. PR against main with issue/companion links, risks, verification and staging steps
   using the [template](../.github/pull_request_template.md). Do not merge or deploy
   without explicit authorization. Green CI and implementation completion are not QA,
   merge or production approval. Shared staging is explicit and must not be overwritten
   automatically; [deployment](deployment.md) points to the sole backend coordinator.

## Docs by exception

Update one canonical doc only for an enduring behavior/rule, public API contract,
architecture decision, operational procedure or developer command change. Ordinary
UI polish, fixes or refactors restoring unchanged rules may have **zero evergreen-doc
changes**; explain that in the PR. Preserve tests for behavior changes regardless.

Use current code/tests, package scripts and machine-readable contracts for facts;
accepted decisions for intent; Issues for scoped requirements; PRs for root cause,
implementation history, test/QA evidence and SHA pairs. Reconcile disagreements
instead of guessing. Edit the owning section, link rather than duplicate, and do
not append phase diaries/test counts/pending status. No arbitrary Markdown line cap.
Historical [plans](archive/README.md) are traceability only, not instructions/backlog.
