# RC Setup Hub frontend

React/TypeScript/Vite client for [RC Setup Hub](https://github.com/BlinovDev/rc-setup-hub).
The backend owns authentication, authorization and the public API contract.

## Local setup

Use Node 24 from [.nvmrc](.nvmrc) and the committed npm lockfile:

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Vite serves localhost:5173 with a strict port. VITE_API_URL defaults to
`http://localhost:8080`; the config helper accepts HTTP(S) origins only, without
credentials, paths, query or fragment. All VITE_* values are public build-time
configuration; never put secrets in them. Local env files are ignored.

Run the separate backend with APP_URL and ALLOWED_ORIGINS set to the frontend
origin, the matching Google callback, and appropriate cookie settings. Use localhost
for both apps locally. See [API integration](AI/api.md); frontend cannot configure
backend CORS or read/manage the HttpOnly cookie.

## Work and verification

- [AGENTS](AGENTS.md): task-aware context loading and boundaries.
- [Product](AI/product.md), [UI](AI/ui.md): enduring client rules and interactions.
- [Architecture](AI/architecture.md), [development](AI/development.md): engineering.
- [API](AI/api.md): copy exact backend OpenAPI and run npm run api:generate;
  commit api/openapi.yaml and src/api/generated/schema.ts, never edit generated types.
- [Testing](AI/testing.md): full Node 24 and browser commands/evidence limits.
- [Workflow](AI/workflow.md), [deployment](AI/deployment.md): linked PRs and release gates.

GitHub Issues/PRs hold task scope, root causes, test reports and live QA status.
[Historical phase plans/reports](AI/archive/README.md) are not current instructions.
