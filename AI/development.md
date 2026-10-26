# Frontend development

Use Node 24 from [.nvmrc](../.nvmrc), npm lockfile installs and strict TypeScript.
[README](../README.md) owns local setup; [testing](testing.md) owns the required
commands and evidence limits.

## Engineering context by responsibility

Load the relevant owner rather than treating this guide as a second rulebook:

| Responsibility | Canonical guidance |
| --- | --- |
| Feature boundaries, shared components, server/local/URL state | [Architecture](architecture.md#ownership) |
| Credentialed client, generated DTOs, auth/cache cancellation, forms and private media | [API integration](api.md) |
| Mobile layout, numeric input, safe feedback, keyboard and focus behavior | [UI](ui.md) |
| Approved scope, documentation impact, PR and release boundaries | [Workflow](workflow.md) |
| Implementation/review role and optional engineering skills | [Engineering skills](engineering-skills.md#routing-and-role-boundaries) |

Avoid `any` except at a justified external boundary. Local view models represent
UI state; generated transport types remain authoritative. Never turn a failed
request into empty data unless the contract explicitly defines that outcome.
Use simple visual tokens; adding a component library needs concrete value within
approved scope.
