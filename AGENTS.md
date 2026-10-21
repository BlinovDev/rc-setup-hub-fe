# RC Setup Hub frontend — task router

Read the task/Issue and [workflow](AI/workflow.md), then only the rows needed below.
Inspect current code/tests and applicable nested instructions before editing. Do
not load all AI documents or historical roadmaps. No prior chat context is required.

| Task | Context to load |
| --- | --- |
| Product / user interaction | [Frontend rules](AI/product.md), relevant [decisions](AI/decisions.md), [UI](AI/ui.md) |
| Implementation / structure | [Architecture](AI/architecture.md), [development](AI/development.md) |
| API / auth / cache / forms | [API integration](AI/api.md), affected [OpenAPI](api/openapi.yaml) schemas/generated types |
| Checks / defect regression | [Testing](AI/testing.md), nearest feature tests |
| Release / staging | [Deployment](AI/deployment.md), backend coordinator policy linked there |
| Documentation / instructions | [Workflow](AI/workflow.md), [context smoke](AI/context-smoke.md); edit only affected sources |

## Non-negotiable boundaries

- Implement approved acceptance criteria only; small, responsive, mobile-first changes.
- Backend owns auth, authorization, visibility and validation. Use its HttpOnly
  cookie with credentials included. No auth/session tokens in browser storage/state.
- Use the shared typed API client and feature query/mutation modules; no scattered
  fetch calls or handwritten copies of generated transport DTOs. Never hand-edit
  generated types. Do not inspect backend source unless explicitly authorized.
- Preserve React/TypeScript/Vite, TanStack Query ownership, React Hook Form/Zod and
  feature modules. Preserve zero versus omitted numbers and unrelated unsaved fields.
- Keep no-store private media, image limits, retry UUIDs, scoped cache invalidation,
  accessibility and safe errors. No secrets or raw server details in the client.
- Docs by exception: change one canonical source for an enduring rule/contract.
  Ordinary fixes/refactors with unchanged invariants may have zero evergreen-doc edits.
- Add/update tests for behavior changes; run Node 24 checks. Mocked browser results
  do not prove physical iPhone, real OAuth or paired live backend behavior.
- Branch and PR against main; cross-link the owning issue and companion PR. Never
  merge, deploy or touch live systems without explicit authorization; CI is not approval.

## Relevant engineering skill only

For authorized changes read [rc-implement](.agents/skills/rc-implement/SKILL.md);
for defects [rc-regression](.agents/skills/rc-regression/SKILL.md).
Design/impact/review tasks select the corresponding skill from
[engineering skills](AI/engineering-skills.md). Reviews are read-only; a self-check
is not independent review. No mandatory chain of all six skills.

## Check entry points (repository root)

Docs: `python3 scripts/verify-docs.py`; instruction/provenance changes also run
`python3 scripts/verify-engineering-skills.py` and the tests in [testing](AI/testing.md).
For code use the Node 24 sequence and browser gate documented there; start locally
with [README](README.md). Report actual results and unavailable prerequisites.
