# Fresh frontend context comprehension smoke

This procedure is read-only and reproducible; static docs checks do not prove Codex
Cloud comprehension. If native Cloud invocation is unavailable, report NOT RUN and
provide these exact steps; do not substitute a coding service or local agent.

1. Start a fresh Cloud task on this repository at the frontend PR SHA, without earlier
   chat or a sibling checkout. Use the exact companion backend PR SHA for shared
   policy links while it is unmerged. Record repository/SHA/tools/clean git status.
2. Send the prompt below. Check actual read traces and responses against the matrix.
3. No edits, remote writes, merge/deploy or live access. Compare git status afterward;
   record task URL/transcript, files read and per-case PASS/FAIL/NOT RUN in the PR.
   An implementation-session self-check is not a fresh-agent pass.

```text
Read-only comprehension smoke: start at AGENTS.md and load only task-relevant
current documents/code/contracts. Do not load historical archives by default.
For each case identify minimum docs, file/section evidence, commands, docs impact
and permission boundary, without editing or writing remotely:
A. A small UI fix restores existing behavior with no enduring rule/API changes.
B. A decimal setup input must preserve blank versus zero and unrelated unsaved data.
C. A backend API feature PR is ready but unmerged; explain exact contract copying,
   generated types, spec owner, separate PRs and compatible version-pair evidence.
D. A green frontend PR is proposed for production without QA/merge authorization.
Distinguish Node/mock-browser checks from physical iPhone/live backend QA. Identify
where HttpOnly credentials, private media and cache-revocation rules live. Report
contradictions or inaccessible cross-repo evidence instead of guessing. End with
actual files read, missing prerequisites and git status. Do not implement.
```

| Case | Expected evidence / boundary |
| --- | --- |
| A | Workflow docs-by-exception permits zero evergreen-doc changes; tests and PR evidence still required |
| B | Product/API/UI and feature tests; blank/zero, numeric precision, full-data PATCH, backend validation authority |
| C | Backend owns shared spec/OpenAPI; FE exact api/openapi.yaml + npm run api:generate into src/api/generated/schema.ts, no manual DTOs or assumed sibling paths |
| D | Green CI is not release permission; backend alone coordinates explicit SHA pairs; no unmerged feature production release or automatic staging overwrite |
| Checks | Node 24 from .nvmrc; docs/skill checks versus application scripts; real OAuth/device/live DB are not proven by MSW/Chromium |

No old roadmap, every AI file or six-skill ceremony is needed. Catalog discovery
requires the distinct [engineering skill smoke](engineering-skills.md), not a manual
file read. If shared backend policy cannot be read, mark that case unverified.
