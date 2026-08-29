# Dashboard MCP Server

The standalone dashboard Model Context Protocol (MCP) server provides the interface through which AI agents inspect and modify dashboard state, settings, and panels in response to user requests.

Its architecture and domain concepts conform to [`ARCHITECTURE.md`](../../ARCHITECTURE.md).

## Standards & Architectural Conformance

| Area                             | Conformance & Guarantees                                                                                                                                                                     |
| :-------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Module Isolation**              | MCP server logic is self-contained in `src/mcp/` without coupling to UI or client layers.                                                                                                  |
| **Entrypoint & Transport**        | Implemented using `@modelcontextprotocol/server` over stdio (`src/mcp/index.ts`), executed via `npm run mcp`.                                                                              |
| **Permission Governance**         | All operations strictly enforce `agentPermissions` (`configuration`, `data`, `panels`) configured via Settings.                                                                            |
| **Privilege Escalation Guard**    | `edit-dashboard-settings` preserves existing Settings-managed `agentPermissions`, preventing agents from modifying their own access levels.                                                |
| **Panel & Formatter Separation**  | Respects the panel contract (UI + JSON Schema) and keeps formatter code separate from display components.                                                                                  |
| **UI Governance**                 | `draft-component` rejects raw HTML elements that React Aria Components already covers, and any styling outside theme tokens (CSS custom properties) and Chota classNames.                 |
| **Sandbox & Path Isolation**      | Enforces path containment to prevent directory traversal outside `data/`, and blocks panel drafts from importing unsafe Node.js runtime APIs (`fs`, `child_process`, `net`, etc.).         |

## Panel authoring workflow

Panels are authored through a staged, per-step-validated draft workflow rather than one late gate:

1. **`draft-schema`** — start or update a panel draft's JSON Schema, title, and sources.
2. **`draft-component`** — set the draft's UI component. Rejects any raw HTML element RAC already provides, inline `style={{}}`, and literal hex/px values.
3. **`draft-formatter`** (optional) — set the draft's formatter, needed only when the source data doesn't already match the schema. If omitted, the commit tools check the panel's refreshed source data against its schema and require a formatter if they don't match; if the source has never been refreshed, the commit is allowed.

Each `draft-*` tool writes into a per-panel draft directory (`.dashboard/drafts/<id>/`). Calling `edit-panel` for an existing panel seeds that draft directory from the panel's current live files on first touch, so a commit can persist after re-running any single draft step without disturbing the rest.

Three commit tools then operate directly on panels:

- **`add-panel`** — commits a brand-new panel from its draft; rejects if the id already exists.
- **`edit-panel`** — commits draft changes over an existing panel id; rejects if the id doesn't exist yet. Replaces the panel's existing configuration entries in place rather than appending.
- **`remove-panel`** — deletes a panel and prunes it from wiring and arrangement automatically.

There is no `preview-panel-package` tool — the client renders the panel locally.

## Registered MCP Tools

The server registers the following tools in `src/mcp/server.ts`:

### `draft-schema`

- **Input Schema**: `{ id: string, title: string, sources: string[], schema: string }`.
- **Required Permissions**: `panels: write`.

### `draft-component`

- **Input Schema**: `{ id: string, component: string }`.
- **Required Permissions**: `panels: write`.

### `draft-formatter`

- **Input Schema**: `{ id: string, formatter: string }`.
- **Required Permissions**: `panels: write`.

### `add-panel`

- **Description**: Commits a new panel from its draft and wires it into the dashboard.
- **Input Schema**: `{ id: string }`.
- **Required Permissions**: `panels: write`.

### `edit-panel`

- **Description**: Commits draft changes over an existing panel.
- **Input Schema**: `{ id: string }`.
- **Required Permissions**: `panels: write`.

### `remove-panel`

- **Description**: Deletes a panel and prunes its dashboard wiring and arrangement.
- **Input Schema**: `{ id: string }`.
- **Required Permissions**: `panels: write`.

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

- **Unit & Contract Tests**: Colocated in `src/mcp/operations.test.ts` and `src/mcp/panel-packages.test.ts`.
- **Run Tests**: `npm test`
- **Type Check**: `npm run typecheck`
- **Start MCP Server**: `npm run mcp`
