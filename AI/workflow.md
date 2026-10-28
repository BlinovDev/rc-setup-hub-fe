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
2. Prefer one fresh task context and one capable agent for BE → FE, after verifying
   real inspect/edit/test/commit/PR capabilities in both repositories. Follow the
   backend [paired workflow](https://github.com/BlinovDev/rc-setup-hub/blob/main/AI/workflow.md#scope-and-implementation):
   backend PR first, immediately continue here without waiting for merge; no
   simulated Cloud launch or silent agent substitution. Cross-repo work has one owning spec Issue,
   linked local deltas, and separate linked PRs; backend OpenAPI changes first.
   Copy the exact [contract](../api/openapi.yaml), regenerate/commit types using
   [API guidance](api.md), and record compatibility/order and exact SHA pair in PRs.
3. Run [targeted tier checks](testing.md#agent-side-verification) with Node 24; full CI
   remains mandatory. Use the shared [CI/context/output budget](https://github.com/BlinovDev/rc-setup-hub/blob/main/AI/workflow.md#context-ci-and-output-budget)
   for one initial current-head status observation and at most one focused repair/recheck.
   Report pending/failed/missing checks and mocked versus physical/live evidence.
4. PR against main with issue/companion links, risks, verification and staging steps
   using the [template](../.github/pull_request_template.md). Do not merge or deploy
   without explicit authorization. Green CI and implementation completion are not QA,
   merge or production approval. Shared staging is explicit and must not be overwritten
   automatically; [deployment](deployment.md) points to the sole backend coordinator.

Measure the next 2–3 features using the backend
[comparison plan](https://github.com/BlinovDev/rc-setup-hub/blob/main/AI/workflow.md#context-ci-and-output-budget),
owned by [Issue #54](https://github.com/BlinovDev/rc-setup-hub/issues/54).
Keep observations in PRs; do not claim token savings without exposed usage data.

## Documentation ownership

The shared [sources of truth and docs-by-exception policy](https://github.com/BlinovDev/rc-setup-hub/blob/main/AI/workflow.md#sources-of-truth)
owns when documentation changes are needed and where task evidence belongs.
Ordinary fixes/refactors with unchanged enduring rules may have **zero evergreen-doc
changes**; explain that in the PR. Edit the canonical owner and link from consumers.

[AGENTS](../AGENTS.md) routes to local canonical owners; [README](../README.md)
owns setup commands. Accepted [decisions](decisions.md) explain intent, not a
parallel procedure. Engineering skill roles/provenance/maintenance live in
[engineering skills](engineering-skills.md), not in implementation guides.
Historical [plans](archive/README.md) are traceability only, not instructions/backlog.

Project Issue intake uses the [frontend setup](project-intake.md); ChatGPT Inbox
access follows the linked backend contract and requires a separate live read test.
