# Frontend release boundary

There is no frontend deployment coordinator or deployment credential store.
The backend [deployment policy](https://github.com/BlinovDev/rc-setup-hub/blob/main/AI/deployment.md)
and [host runbook](https://github.com/BlinovDev/rc-setup-hub/blob/main/scripts/server/README.md)
own all release configuration, protocol, environment isolation, backup/migration,
health and recovery details. Do not maintain a second copy here.

Each release selects an explicit compatible BE/FE SHA pair, even for one-sided work;
OpenAPI bytes must match, generated types must be clean, both repositories' checks
must pass. Feature-PR contract consumption does not require an early backend merge.

Only the backend manually dispatched workflow deploys. Staging is shared and explicit;
record pair and QA evidence in linked PRs. Production requires separately authorized
merge/release, main-reachable SHAs in both repositories and all environment gates.
Green CI never authorizes merge/deploy; do not cancel an in-flight deployment or
assume automatic rollback. Environment-specific VITE_API_URL requires a separate
production build, not promotion of the staging bundle byte-for-byte.

For photo releases, the selected backend must support the contract, have its pinned
native codecs/private isolated media, nginx limits, runtime --check-media and coherent
DB+media backup/restore gates. The local placeholder never becomes backend metadata.
