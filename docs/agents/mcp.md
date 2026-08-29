# Dashboard MCP Server

The standalone dashboard Model Context Protocol (MCP) server provides the interface through which AI agents inspect and modify dashboard state, configuration, and panel packages in response to user requests.

Its architecture and domain concepts conform to [`ARCHITECTURE.md`](../../ARCHITECTURE.md).

## Standards & Architectural Conformance

| Area                             | Conformance & Guarantees                                                                                                                                                                   |
| :------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Module Isolation**             | MCP server logic is self-contained in `src/mcp/` without coupling to UI or client layers.                                                                                                  |
| **Entrypoint & Transport**       | Implemented using `@modelcontextprotocol/server` over stdio (`src/mcp/index.ts`), executed via `npm run mcp`.                                                                              |
| **Permission Governance**        | All operations strictly enforce `agentPermissions` (`configuration`, `data`) configured via Settings.                                                                                      |
| **Privilege Escalation Guard**   | `replace-dashboard-configuration` preserves existing Settings-managed `agentPermissions`, preventing agents from modifying their own access levels.                                        |
| **Panel & Formatter Separation** | Respects the panel contract (UI + JSON Schema) and keeps formatter code separate from display components.                                                                                  |
| **Sandbox & Path Isolation**     | Enforces path containment to prevent directory traversal outside the workspace, and blocks panel packages from importing unsafe Node.js runtime APIs (`fs`, `child_process`, `net`, etc.). |

## Registered MCP Tools

The server registers the following tools in `src/mcp/server.ts`:

### 1. `preview-panel-package`

- **Description**: Validates an ephemeral panel package (manifest, schema, component, and optional formatter) prior to applying.
- **Input Schema**:
  - `manifest`: Panel package manifest object (`id`, `title`, `schema`, `component`, `formatter?`, `sources`).
  - `schema`: Stringified JSON Schema for panel data.
  - `component`: Source code string for React component (`panel.tsx`).
  - `formatter` (optional): Source code string for formatter module (`formatter.ts`).

### 2. `apply-panel-package`

- **Description**: Atomically writes an approved panel package to `panels/<id>/` and updates dashboard configuration wiring and arrangement.
- **Required Permissions**: `configuration: write`, `data: write`.
- **Input Schema**: Same as `preview-panel-package`.

### 3. `refresh`

- **Description**: Refreshes data from an external service integration (e.g. Google Calendar) into local retained storage.
- **Required Permissions**: `data: write`.
- **Input Schema**: `{ source: string }`.

### 4. `inspect-dashboard-configuration`

- **Description**: Reads and returns current `DashboardConfiguration`.
- **Required Permissions**: `configuration: read`.
- **Input Schema**: `{}`.

### 5. `replace-dashboard-configuration`

- **Description**: Replaces the dashboard configuration while retaining current `agentPermissions`.
- **Required Permissions**: `configuration: write`.
- **Input Schema**: `{ configuration: unknown }`.

### 6. `read-dashboard-file`

- **Description**: Reads a workspace file or data file.
- **Required Permissions**: `data: read`.
- **Input Schema**: `{ path: string }`.

### 7. `write-dashboard-file`

- **Description**: Writes a workspace file or data file (cannot directly overwrite `dashboard.json`).
- **Required Permissions**: `data: write`.
- **Input Schema**: `{ path: string, content: string }`.

## Testing & Verification

- **Unit & Contract Tests**: Colocated in `src/mcp/operations.test.ts` and `src/mcp/panel-packages.test.ts`.
- **Run Tests**: `npm test`
- **Type Check**: `npm run typecheck`
- **Start MCP Server**: `npm run mcp`
