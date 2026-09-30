# RC Setup Hub Frontend — Codex instructions

This repository is the separate user-facing client for RC Setup Hub.

Build it incrementally. Keep every phase small, testable, and easy to review.

## Read before changing code

Start with `AI/main.md`. Then read the documents relevant to the task:

- architecture: `AI/architecture.md`
- backend/API integration: `AI/api.md`
- UI/routes: `AI/ui.md`
- development rules: `AI/development.md`
- testing: `AI/testing.md`
- implementation sequence: `AI/roadmap.md`
- accepted decisions: `AI/decisions.md`

Do not silently contradict `AI/decisions.md`.

## Core development rules

- Implement one roadmap phase at a time.
- Do not implement later-phase features opportunistically.
- Keep the frontend repository independent from the Go backend repository.
- The backend remains the source of truth for authentication, authorization, visibility, validation, friendship state, and persisted data.
- Never store auth/session tokens in `localStorage`, `sessionStorage`, or frontend state.
- Authenticated API requests must use the backend HttpOnly session cookie with credentials enabled.
- Once backend OpenAPI exists, generated API types are the source of truth. Do not hand-write duplicate transport interfaces for schemas that already exist in generated types.
- Keep API access behind the shared API client and feature-specific query/mutation modules. Components must not scatter raw `fetch` calls.
- Use TanStack Query for server state. Do not introduce Redux/Zustand unless an accepted decision later requires it.
- Use React Hook Form for non-trivial forms and Zod for client-side form parsing/validation where useful.
- Preserve backend semantics: an omitted numeric setup value is different from an explicit numeric `0`.
- Do not reproduce backend authorization logic as a security mechanism. UI may hide actions for UX, but the backend remains authoritative.
- Prefer feature-oriented modules over large global `components/`, `hooks/`, or `services/` buckets.
- Keep UI responsive and mobile-first.
- Add or update tests for every behavior change.
- Never commit secrets, real OAuth credentials, or production endpoints.

## Completion rule

A phase is complete only when:

1. implementation matches that phase's acceptance criteria;
2. relevant tests pass;
3. production build succeeds;
4. no unrelated feature scope was added;
5. documentation is updated if the client contract changed.

When asked to implement a roadmap phase, first read the referenced AI docs, implement only that phase, run its verification commands, and report changed files and test/build results.
