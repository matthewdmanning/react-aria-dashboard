# Repository Guidelines

## Project Structure & Module Organization

This is a single-package, single-process TypeScript repository.

- `src/dashboard/` is the central domain module; callers use its interface through `index.ts`.
- `src/client/` contains the React Aria UI, panels, and themes.
- `src/server/` owns persistence, authentication, and external integrations.
- `src/mcp/` owns the standalone MCP server and its tools.
- Keep focused tests beside their modules; use `tests/` for whole-app behavior.
- `examples/dashboard.json` is sample data, never the runtime source of truth.
- `ARCHITECTURE.md` is the authoritative architecture document, domain vocabulary included, and supersedes conflicting statements elsewhere.
- `agent-docs/` holds the product specification.
- Runtime dashboard data and installed themes belong at a configurable path outside `src/`.

Keep the dashboard general-purpose. Job-search and study data are examples, not permanent domain concepts.

## Documentation Authority

Before coding, read the active checkout's `ARCHITECTURE.md`, `AGENTS.md`, and relevant current product specification. Use the latest active documentation even when issues, comments, audits, old branches, memory, examples, tests, or implementation disagree. Stop and correct active documentation before coding if authoritative documents conflict.

Never derive current requirements from material marked legacy, quarantined, superseded, archived, or backup. Quarantined material is historical evidence only.

For dependency and framework guidance, use current Context7 documentation before web search. If Context7 does not contain the needed documentation, record that limitation before using a web source.

## Build, Test, and Development Commands

- `npm run dev` starts Vite for local development.
- `npm run build` typechecks and builds the application.
- `npm run typecheck` runs TypeScript without emitting files.
- `npm test` runs the automated test suite.
- `npm run test:e2e` runs the Playwright checks.
- `npm run mcp` starts the dashboard MCP server.

Only document commands that have matching scripts in `package.json`.

## Coding Style & Naming Conventions

Use TypeScript for application code and React Aria Components for accessible complex controls. Prefer native HTML and CSS when sufficient. Use two-space indentation, `PascalCase` for React components, `camelCase` for functions and variables, and kebab-case filenames for documentation.

No formatter or linter is configured yet. Add tool-specific rules here only after the tool is installed.

## Testing Guidelines

When coding a section governed by a contract, write its contract tests before implementing that section. Cover the interface functions and behaviors promised by the contract, then implement code that passes those tests and accomplishes the stated purpose.

Every test must be load-bearing and represent a likely real use. Do not add tests for errors that would already necessarily fail through the runtime, compiler, or existing caller path. Code without a contract is not subject to a blanket test-first rule.

Name focused colocated tests `*.test.ts` or `*.test.tsx`; reserve `tests/app.test.ts` for whole-app behavior.

## Commit & Pull Request Guidelines

Git history and commit conventions do not exist yet. Use short, imperative commit subjects, for example `Add dashboard payload validation`.

Pull requests should explain the user-visible change, link the relevant GitHub issue, report verification performed, and include screenshots for interface changes. Keep unrelated changes in separate pull requests.

## Security & Configuration

Never commit credentials, tokens, local dashboard data, sensitive field names or values, or unencrypted cloud-backup contents. Example fixtures must contain no personal or sensitive data.

## Agent skills

### Issue tracker

Issues and PRDs are tracked with GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the five default triage labels. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repository. See `docs/agents/domain.md`.
