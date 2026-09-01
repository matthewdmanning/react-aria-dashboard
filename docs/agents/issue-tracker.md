# Issue tracker: GitHub

Issues and PRDs for this repo live as GitHub issues. Use the connected GitHub integration for GitHub operations.

Do not check or require local `gh` authentication before using the integration. The integration and the local CLI have separate authentication. Use `gh` only as a fallback when the integration is unavailable or cannot perform the required operation. Never use `Invoke-RestMethod`, `curl`, web search, or browser access to bypass that routing; if both approved paths fail, report the blocker.

## Conventions

- **Create an issue**: use the integration's issue-create operation.
- **Read an issue**: use the integration's issue-read operation, including comments and labels.
- **List issues**: use the integration's issue-search/list operation with the required label and state filters.
- **Comment on an issue**: use the integration's issue-comment operation.
- **Apply / remove labels**: use the integration's issue-label operation.
- **Close**: use the integration's issue-update operation.

The `gh issue ...` equivalents below are fallback commands only, not the primary procedure.

Infer the repo from `git remote -v` when a fallback CLI command is necessary.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_

When set to `yes`, PRs run through the same labels and states as issues, using the connected integration's PR operations. The `gh pr ...` equivalents are fallback commands only:

- **Read a PR**: `gh pr view <number> --comments` and `gh pr diff <number>` for the diff.
- **List external PRs for triage**: `gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments` then keep only `authorAssociation` of `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR`, or `NONE` (drop `OWNER`/`MEMBER`/`COLLABORATOR`).
- **Comment / label / close**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`.

GitHub shares one number space across issues and PRs, so a bare `#42` may be either — resolve with `gh pr view 42` and fall back to `gh issue view 42`.

## When a skill says "publish to the issue tracker"

Create a GitHub issue through the connected integration.

## When a skill says "fetch the relevant ticket"

Read the issue through the connected integration, including comments and labels. Fall back to `gh issue view <number> --comments` only if the integration cannot perform the read.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

Use the connected integration for every GitHub operation in this section. The `gh` snippets are fallback CLI equivalents only.

- **Map**: a single issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body. `gh issue create --label wayfinder:map`.
- **Child ticket**: an issue linked to the map as a GitHub sub-issue (`gh api` on the sub-issues endpoint). Where sub-issues aren't enabled, add the child to a task list in the map body and put `Part of #<map>` at the top of the child body. Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: GitHub's **native issue dependencies** — the canonical, UI-visible representation. Add an edge with `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, where `<blocker-db-id>` is the blocker's numeric **database id** (`gh api repos/<owner>/<repo>/issues/<n> --jq .id`, not the `#number` or `node_id`). GitHub reports `issue_dependencies_summary.blocked_by` (open blockers only — the live gate). Where dependencies aren't available, fall back to a `Blocked by: #<n>, #<n>` line at the top of the child body. A ticket is unblocked when every blocker is closed.
- **Frontier query**: list the map's open children (`gh issue list --state open`, scoped to the map's sub-issues / task list), drop any with an open blocker (`issue_dependencies_summary.blocked_by > 0`, or an open issue in the `Blocked by` line) or an assignee; first in map order wins.
- **Claim**: `gh issue edit <n> --add-assignee @me` — the session's first write.
- **Resolve**: `gh issue comment <n> --body "<answer>"`, then `gh issue close <n>`, then append a context pointer (gist + link) to the map's Decisions-so-far.
