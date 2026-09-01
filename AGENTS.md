# Agent Router

What you need, and where it lives. This file routes; it does not restate. Where a fact has a real source — `package.json`, the git log, the filesystem — go there rather than trusting a copy.

## Read before working

| You need                                         | Read                                                                                             |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| What was decided when planning — authoritative, ahead of the code | [`agent-docs/architecture-decisions.md`](agent-docs/architecture-decisions.md)   |
| What a term means                                | [`CONTEXT.md`](CONTEXT.md)                                                                       |
| How the app is built, and where a concern lives  | [`ARCHITECTURE.md`](ARCHITECTURE.md)                                                             |
| What the product must do, and what is still open | [`agent-docs/personal-dashboard-product-spec.md`](agent-docs/personal-dashboard-product-spec.md) |
| Why a choice was made                            | [`docs/agents/rationale.json`](docs/agents/rationale.json), keyed by term                        |
| How to write code here                           | [`docs/agents/conventions.md`](docs/agents/conventions.md)                                       |
| What was researched, with sources                | [`docs/agents/research/`](docs/agents/research/)                                                 |
| The MCP tool surface                             | [`docs/agents/mcp.md`](docs/agents/mcp.md)                                                       |
| How issues are tracked                           | [`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md)                                   |
| Triage labels                                    | [`docs/agents/triage-labels.md`](docs/agents/triage-labels.md)                                   |
| Available commands                               | `package.json` scripts                                                                           |
| Commit message style                             | Conventional Commits; see `git log`                                                              |
| Example source data shapes                       | `templates/`                                                                                     |
| What a finished card should look like            | `examples/` — unreviewed product examples, not patterns to copy                                  |

## Non-negotiables

- Never commit credentials, tokens, personal content, real dashboard data, or sensitive field names or values. Fixtures are placeholder-only.
- Keep the dashboard general-purpose. Job-search and study data are examples, never domain concepts.
- Do not derive current requirements from material marked legacy, quarantined, superseded, archived, or backup.

## When documents disagree

Each fact has exactly one home. Two documents stating the same fact is a bug — fix it by deleting one, not by deciding which wins.
