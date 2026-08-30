# Dashboard MCP Server

The standalone dashboard Model Context Protocol (MCP) server provides the interface through which AI agents inspect and modify dashboard state, settings, and cards in response to user requests.

Its architecture and domain concepts conform to [`ARCHITECTURE.md`](../../ARCHITECTURE.md).

## Standards & Architectural Conformance

| Area                           | Conformance & Guarantees                                                                                                                                                                                                  |
| :----------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Module Isolation**           | MCP server logic is self-contained in `src/mcp/` without coupling to UI or client layers.                                                                                                                                 |
| **Entrypoint & Transport**     | Implemented using `@modelcontextprotocol/server` over stdio (`src/mcp/index.ts`), executed via `npm run mcp`.                                                                                                             |
| **Permission Governance**      | All operations strictly enforce `agentPermissions` (`configuration`, `data`, `cards`) configured via Settings.                                                                                                            |
| **Privilege Escalation Guard** | `edit-dashboard-settings` preserves existing Settings-managed `agentPermissions`, preventing agents from modifying their own access levels.                                                                               |
| **Cards are data, never code** | `add-card`/`edit-card` take a template, a source, and a formatter — never UI or formatter source text. Governance is structural: there is no field to put a raw HTML element, an off-token color, or arbitrary code into. |
| **Sandbox & Path Isolation**   | Enforces path containment to prevent directory traversal outside `data/`.                                                                                                                                                 |

## Card authoring workflow

A card is a config entry, not code. `add-card`/`edit-card` take:

- **`template`** — a key into the fixed, code-defined card template registry (`src/dashboard/card-templates.ts` for schemas, `src/client/cards/` for the paired UI). Card templates are added by editing source directly, not through this MCP interface — this is deliberately rare and reviewed like any other code change.
- **`source`** — the id of a file under `data/` (see `read-data-file`/`edit-data-file`) or a saved integration.
- **`formatter`** (optional) — `"identity"` if the source data already matches the template's schema, a fixed built-in name, or omitted to default to `"identity"`.
- **`formatterSpec`** (optional) — a declarative mapping spec (field renaming, `??` fallback chains, defaults, array mapping — see `compileFormatterSpec` in `src/dashboard/index.ts`) when the source data needs reshaping. Persisted under `formatterSpecs` in the dashboard configuration, keyed by formatter id.

`add-card`/`edit-card` proactively validate: the `template` must be real, and if a formatter can be evaluated server-side (`identity` or a `formatterSpec`), its output is checked against the template's zod schema before anything is persisted. Named built-in formatters (`message`, `google-calendar`) are trusted app-shell code and skip this check.

- **`add-card`** — adds a new card; rejects if the id already exists.
- **`edit-card`** — replaces an existing card's template/source/formatter in place; rejects if the id doesn't exist yet. Position in `arrangement` is preserved.
- **`remove-card`** — deletes a card and prunes it from wiring, arrangement, and any `formatterSpecs` entry no longer referenced by another card.

There is no draft pipeline, no on-disk card package, no `draft-schema`/`draft-component`/`draft-formatter` — a card commits in one call.

## Registered MCP Tools

The server registers the following tools in `src/mcp/server.ts`:

### `add-card`

- **Description**: Adds a new card.
- **Input Schema**: `{ id: string, title: string, template: string, source: string, formatter?: string, formatterSpec?: FormatterSpec }`.
- **Required Permissions**: `cards: write`.

### `edit-card`

- **Description**: Replaces an existing card's template, source, and formatter.
- **Input Schema**: same shape as `add-card`.
- **Required Permissions**: `cards: write`.

### `remove-card`

- **Description**: Deletes a card and prunes its dashboard wiring, arrangement, and unused formatter spec.
- **Input Schema**: `{ id: string }`.
- **Required Permissions**: `cards: write`.

### `refresh`

- **Description**: Refreshes data from an external service integration (e.g. Google Calendar) into local retained storage.
- **Required Permissions**: `data: write`.
- **Input Schema**: `{ source: string }`.

### `read-dashboard-settings`

- **Description**: Reads and returns current `DashboardConfiguration`.
- **Required Permissions**: `configuration: read`.
- **Input Schema**: `{}`.

### `edit-dashboard-settings`

- **Description**: Replaces dashboard settings while retaining current `agentPermissions`.
- **Required Permissions**: `configuration: write`.
- **Input Schema**: `{ configuration: unknown }`.

### `read-data-file`

- **Description**: Reads a file under `data/`.
- **Required Permissions**: `data: read`.
- **Input Schema**: `{ path: string }`.

### `edit-data-file`

- **Description**: Writes a file under `data/`.
- **Required Permissions**: `data: write`.
- **Input Schema**: `{ path: string, content: string }`.

## Testing & Verification

- **Unit & Contract Tests**: Colocated in `src/mcp/operations.test.ts` and `src/dashboard/configuration.test.tsx` (formatter spec interpreter).
- **Run Tests**: `npm test`
- **Type Check**: `npm run typecheck`
- **Start MCP Server**: `npm run mcp`
