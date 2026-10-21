# Frontend Project intake

[Project #2](https://github.com/users/BlinovDev/projects/2) uses the existing backend
native Auto-add rule plus this repository's
[Issue workflow](../.github/workflows/add-issues-to-project.yml). Only opened,
reopened and transferred Issues are added; PRs are excluded. No checkout or issue
text execution occurs. The default GITHUB_TOKEN has no permissions and is not the
Project credential. Existing CI and deployment rules are unchanged.

## Credential setup

The owner must create an expiring classic PAT with `project` scope for this
**user-owned** project and save it as frontend repository Actions secret
`PROJECT_2_TOKEN` (Settings → Secrets and variables → Actions). Add `repo` only if
private repository contents require it; do not grant unrelated scopes. Classic
`project` is broader than this board: treat it as a write credential, rotate/revoke
it, restrict who can edit trusted default-branch workflows and never share it with
ChatGPT. Never place it in a VITE variable, source, command argument, log or issue.
Missing credentials fail explicitly; expired/insufficient credentials fail the Action.

Organization Projects App/fine-grained PAT examples are not automatically valid for
a personal user project. If replacing the PAT with a GitHub App, first verify that
the chosen token type can access this user-owned Project and read the source Issues,
then use short-lived tokens with Project write and only necessary repository read
permissions. Do not silently expand permissions or assume GITHUB_TOKEN suffices.

The pinned maintained action uses addProjectV2ItemById for our matching owner
BlinovDev; GitHub returns an existing item when already added. Reopen/rerun does not
create a second item or set Status. Keep the board's existing default/Inbox automation
and backend native Auto-add unchanged; the Action does not configure either.

## Live acceptance test (after authorized merge and credential setup)

1. Confirm this workflow exists on main (Issues workflows use the default branch).
   Create a temporary frontend Issue titled `Project intake smoke — delete after QA`.
2. Open its Actions run; record run URL, workflow SHA and successful add step. In
   Project #2 confirm exactly one repository Issue item with the same URL and the
   board's existing default status/Inbox placement. A green run alone is insufficient.
3. Close/reopen the Issue and rerun its completed workflow; verify the same item ID,
   count=1 and unchanged status. Transfer a temporary Issue from another owned test
   repository into frontend and verify the transferred event similarly. Confirm a
   new PR is not added by this workflow. Do not change backend auto-add to test this.
4. Record evidence in the PR; close temporary Issues and remove their board items
   after QA. If credentials/board access are unavailable, mark live test BLOCKED.

ChatGPT reads, draft handling, pagination and the approval gate have one canonical
[contract/setup plan](https://github.com/BlinovDev/rc-setup-hub/blob/main/AI/project-intake.md).
This Action does not expose Project data to ChatGPT.
