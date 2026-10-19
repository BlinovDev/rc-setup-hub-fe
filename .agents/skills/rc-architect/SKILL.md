---
name: "rc-architect"
description: "Analyze architecture, ownership, interfaces, and design alternatives before a non-trivial change. Read-only analysis; does not start implementation."
license: "MIT"
---

# Architecture analysis

Read applicable AGENTS.md, AI/architecture.md, AI/decisions.md and the relevant product/API docs.
Trace the existing flow from caller through the canonical owner to external boundaries.
Describe why the current boundary exists using code and accepted decisions, not guesses.

Sketch the smallest viable design in the report: caller usage, types/signatures, ownership,
state transitions and failure handling. For a genuine structural tradeoff compare distinct
viable shapes, including reuse of the current design; do not manufacture alternatives for
trivial work. Judge information hiding, cohesive ownership, coupling and testability.
Look for split state ownership, pass-through layers, hand-synchronized representations,
and callers forced to coordinate internal stages. Do not replace project-approved contracts
with an upstream preference for a different type model or architecture.

Frontend focus: use this repository's api/openapi.yaml and generated transport types;
do not inspect Go source or another checkout unless explicitly requested. Preserve the shared
credentialed API client, backend-owned auth/authorization, TanStack Query ownership/invalidation,
feature modules, zero versus omitted numeric values, responsive accessibility and photo lifecycle.
Use Vitest/RTL/MSW boundaries and the documented browser gate where required. Mocked HTTP and
emulated Chromium do not establish real OAuth, physical phone/HEIC or paired live QA correctness.

Return evidence with file locations, constraints, tradeoffs, a recommended bounded design,
verification needs and unresolved decisions. Distinguish proposed design from existing facts.
Read-only: no scaffolds, edits, generated artifacts or implementation commits. No background
model orchestration or assumed companion tools. Analysis never authorizes implementation,
merging, deployment, or broad refactoring; those require an authorized task.

Adapted sources, revisions and licenses: [engineering skills](../../../AI/engineering-skills.md) (pstack).
