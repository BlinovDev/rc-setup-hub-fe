# SEO and static rendering boundary

Only successful public setup detail is index-eligible. One route metadata owner
observes the existing detail query without another request. It sets a unique title,
bounded description, query-free same-origin canonical URL, robots and Open Graph /
Twitter text metadata using DOM text/attributes. Public media is revocable and
credential-aware, so no persistent OG image URL is advertised. Private/friends,
account, profile, unresolved and error routes retain generic metadata and noindex.
Metadata resets on route/viewer changes and access-loss responses.

The current deployment serves a **static Vite SPA**. index.html deliberately starts
with generic metadata and noindex: it cannot safely infer visibility from a path.
Browser tests inspect both that raw HTML and the later API-backed rendered DOM.
This does **not** prove search indexing or link-unfurl previews. Some crawlers do not
execute JavaScript, and initial noindex can prevent rendering entirely. Do not claim
public pages are indexed or expose richer previews from these client tags alone.
Actual host/proxy headers may impose further restrictions and require live inspection.

public/robots.txt excludes account/auth/profile routes. It is a crawler hint, never
access control. No sitemap is generated from owner/private lists. The backend owns
API visibility and X-Robots-Tag; its API headers do not set SPA HTML metadata.

SSR or visibility-aware prerendering plus a public-only sitemap is a separate,
reviewed architecture/deployment decision. It would need current public authorization,
revocation/cache policy, safe HTML escaping and host verification. No backend,
reverse-proxy or hosting changes are made by the frontend guest implementation.
