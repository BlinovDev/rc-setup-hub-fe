# RC Setup Hub Frontend — Codex instructions

This repository is the separate user-facing client for RC Setup Hub. Keep changes small, testable, and easy to review.

## Read before changing code

Start with `AI/main.md` and `AI/product.md`. For feature delivery or work that may reach staging/production, also read `AI/workflow.md`. Then read the documents relevant to the task:

- product/business rules: `AI/product.md`
- feature delivery lifecycle: `AI/workflow.md`
- architecture: `AI/architecture.md`
- backend/API integration: `AI/api.md`
- UI/routes: `AI/ui.md`
- development rules: `AI/development.md`
- testing: `AI/testing.md`
- implementation sequence: `AI/roadmap.md`
- accepted decisions: `AI/decisions.md`

Do not silently contradict accepted decisions or business rules. If a task conflicts with `AI/decisions.md` or materially changes `AI/product.md`, make that change explicit in the specification/PR instead of guessing.

For new feature requests, treat GitHub Issue/PR state and repository docs as durable context. Do not rely on previous chat history being available.

## Core development rules

- For roadmap work, implement one roadmap phase at a time.
- For post-roadmap feature work, implement only the approved acceptance criteria.
- Do not implement unrelated features opportunistically.
- Keep the frontend repository independent from the Go backend repository.
- The backend remains the source of truth for authentication, authorization, visibility, validation, friendship state, and persisted data.
- Never store auth/session tokens in `localStorage`, `sessionStorage`, or frontend state.
- Authenticated API requests must use the backend HttpOnly session cookie with credentials enabled.
- Generated API types are the source of truth. Do not hand-write duplicate transport interfaces for schemas that already exist in generated types.
- Keep API access behind the shared API client and feature-specific query/mutation modules. Components must not scatter raw `fetch` calls.
- Use TanStack Query for server state. Do not introduce Redux/Zustand unless an accepted decision later requires it.
- Use React Hook Form for non-trivial forms and Zod for client-side form parsing/validation where useful.
- Preserve backend semantics: an omitted numeric setup value is different from an explicit numeric `0`.
- Do not reproduce backend authorization logic as a security mechanism.
- Prefer feature-oriented modules over large global technical buckets.
- Keep UI responsive and mobile-first.
- Add or update tests for every behavior change.
- Never commit secrets, real OAuth credentials, or production endpoints.
- Update `AI/product.md` in the same PR when user-visible behavior or a business rule changes.
- For cross-repository API changes, consume the updated backend OpenAPI contract and link the backend PR.

## Completion rule

A task is complete only when:
1. implementation matches its acceptance criteria;
2. relevant tests pass;
3. production build succeeds for code changes;
4. no unrelated feature scope was added;
5. documentation is updated when product behavior or the client contract changed;
6. staging/QA/production gates in `AI/workflow.md` are respected when applicable.

When asked to implement a roadmap phase, first read the referenced AI docs, implement only that phase, run its verification commands, and report changed files and test/build results.

## Backend API contract

The frontend must use `api/openapi.yaml` as the machine-readable backend contract.

Rules:
- Do not infer API shapes from assumptions.
- Do not inspect or depend on Go backend source code unless explicitly asked.
- Do not manually recreate API response/request interfaces when they can be generated from OpenAPI.
- Generated API types belong under `src/api/generated/`.
- Do not manually edit generated files.
- Backend authorization rules must not be duplicated as frontend security logic.
- HttpOnly cookie authentication is backend-owned.
- Never store authentication tokens in localStorage or sessionStorage.
- All authenticated browser API requests must use credentials.
- If implementation and OpenAPI appear inconsistent, stop and report the mismatch instead of guessing.
