# Repository Guidelines

## Project Structure & Module Organization

This is a single-package, single-process TypeScript repository.

- `src/dashboard/` is the central domain module; callers use its interface through `index.ts`.
- `src/client/` contains the React Aria UI, panels, and themes.
- `src/server/` owns persistence, authentication, MCP tools, and external integrations.
- Keep focused tests beside their modules; use `tests/` for whole-app behavior.
- `examples/dashboard.json` is sample data, never the runtime source of truth.
- `CONTEXT.md` defines domain vocabulary; `agent-docs/` holds the product specification.
- Runtime dashboard data and installed themes belong at a configurable path outside `src/`.

Keep the dashboard general-purpose. Job-search and study data are examples, not permanent domain concepts.

## Build, Test, and Development Commands

The repository is structurally scaffolded, but dependencies and package scripts are intentionally not configured yet. Add commands here only when matching scripts exist in `package.json`.

## Coding Style & Naming Conventions

Use TypeScript for application code and React Aria Components for accessible complex controls. Prefer native HTML and CSS when sufficient. Use two-space indentation, `PascalCase` for React components, `camelCase` for functions and variables, and kebab-case filenames for documentation.

No formatter or linter is configured yet. Add tool-specific rules here only after the tool is installed.

## Testing Guidelines

No testing framework or coverage threshold is established. New non-trivial behavior should include the smallest automated check that proves it works. Name colocated tests `*.test.ts` or `*.test.tsx`; reserve `tests/app.test.ts` for whole-app behavior.

## Commit & Pull Request Guidelines

Git history and commit conventions do not exist yet. Use short, imperative commit subjects, for example `Add dashboard payload validation`.

Pull requests should explain the user-visible change, link the relevant GitHub issue, report verification performed, and include screenshots for interface changes. Keep unrelated changes in separate pull requests.

## Security & Configuration

Never commit credentials, tokens, local dashboard data, or unencrypted cloud-backup contents. Keep the canonical JSON file local unless a documented example fixture contains no personal data.

## Agent skills

### Issue tracker

Issues and PRDs are tracked with GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the five default triage labels. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repository. See `docs/agents/domain.md`.
