# Handoff — 2026-08-30

Session artifact from a repo overhaul. Not part of the documentation set; delete once acted on.

## Build gate

`npm run check` = format, typecheck, test, build. **It passes.** Real test count is 29 across 7 files.

Four things were fixed to get there:

- A stale worktree at `.claude/worktrees/agent-a56a6bdb8ce4fb81f`. Vitest collected a duplicate suite through it (15 test files where `src/` has 7) and Prettier scanned a second copy of every doc. Removed.
- A second stale worktree in `%TEMP%`, holding `dev/issue-15-portable-reference-paths`. Removed.
- No `.gitattributes`. With `core.autocrlf=true` on Windows, Git wrote CRLF on checkout while Prettier expects LF, so the check broke after _any_ fresh checkout. Now pinned to `eol=lf`.
- Playwright removed entirely: the `test:e2e` script, `playwright.config.ts`, and the `@playwright/test` dependency. It had `testDir: "tests/e2e"`, a directory that was never created — zero e2e tests. Its `webServer` ran `npm run dev -- --host --port`, but `npm run dev` is `tsx src/server/index.ts`, a Node HTTP server that ignores those Vite flags, so it never bound the port and timed out after 60s on every run. It was a broken gate guarding nothing.

If e2e comes back, it needs a decision on how the test server starts.

## Not done — waiting on you

### Branches, not deleted

Deletion was proposed and stopped. Nothing was removed. These are the stale local branches, with SHAs captured so the list stays useful whenever you decide:

| Branch                                | SHA     | Also on origin |
| ------------------------------------- | ------- | -------------- |
| chore/mcp-tooling                     | d31ce2c | no             |
| code-audit                            | 82f625f | yes            |
| dev/architecture-authority            | 7c6c09b | yes            |
| dev/issue-1-component-contract        | 60257cf | no             |
| dev/issue-2-dashboard-persistence     | e67a4a4 | no             |
| dev/issue-3-semantic-themes           | 609b0d2 | no             |
| dev/issue-4-mcp-inspection-preview    | 71c35a1 | no             |
| dev/issue-4-mcp-proposals             | 6f9f1dc | no             |
| dev/issue-5-table-cards               | 1889f55 | no             |
| dev/issue-6-checklist                 | 521b22b | no             |
| dev/issue-7-calendar                  | aa984e5 | no             |
| dev/issue-8-chart                     | 6e7a4ee | no             |
| dev/issue-9-public-google-calendar    | a1d8153 | no             |
| dev/issue-15-portable-reference-paths | 4490644 | yes            |
| integration/issues-1-15               | ec59228 | yes            |
| repo-setup                            | 5a42999 | yes            |
| research/chota-styling                | 120c0f4 | no             |
| research/react-aria-hooks             | 4fe06a0 | no             |
| worktree-agent-a56a6bdb8ce4fb81f      | da8f001 | no             |

Both research notes were copied into `docs/agents/research/` already, so the two `research/*` branches carry nothing unique.

Three older stashes were left untouched: one on `code-audit`, two on `main`. All predate this session.

### Issues, not deleted

Still open, and flagged as wrongly created: **#11 Install third-party UI themes**, **#12 Back up and restore encrypted dashboard data**, **#13 Protect externally accessible operation**, **#14 Package the complete first release**, **#24 Add the direct Settings UI**.

GitHub issue deletion is permanent and cannot be undone from the UI. Closing is reversible; deleting is not. Say which you want.

## Ask me about this

The wayfinder map's _Decisions so far_ records only the research ticket. Decisions made in conversation today were never written onto the tickets they answer:

- Vocabulary — card template vs card, display-role keys, empty schemas. Answers part of **Define the component contract (#48)**.
- The five card templates were renamed, not reconsidered. Answers part of **Fate of the five existing card variants (#52)**.
- **Two separate MCP servers**, one for card design and one for everyday adjustments. This looks like the answer to **Split design mode from everyday data updates (#49)**, and it may reshape the map.

Question: update those tickets with what was decided, close them as answered, or delete them?

## Unresolved contradiction

`agent-docs/personal-dashboard-product-spec.md` L25 and L33 still describe the old model — agents creating or changing cards' "UIs, JSON Schemas, formatter code", and cards "composed of a UI and JSON Schema". That is exactly what **Bound or reverse the panels-as-data decision (#46)** exists to settle, so it was left alone rather than decided by editing prose.

## Nothing is pushed

`main` is still at `74bf45c`. All work is on local branches; see `git log main..docs-restructure`.

Branches created this session, in stacking order:

1. `build-add-react-aria-components` — declares `react-aria-components@^1.20.0`.
2. `refactor-card-template` — merges the above; renames card variant → card template across the MCP surface and registry, sanitises `examples/`, adds `templates/`.
3. `docs-restructure` — the documentation split, the `definition` → `template` rename, `.gitattributes`, and the Playwright removal.
