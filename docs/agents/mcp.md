# Dashboard MCP Server

`src/mcp/` owns MCP tool definitions only. Each write tool constructs one
contract mutation and calls `DashboardService.apply`; the read tool calls
`DashboardService.read`. Persistence, authentication, authorization, and
mutation application belong to `src/service/`.

The stdio entrypoint in `src/mcp/index.ts` composes a file-backed service and
passes it to the MCP server. Run it with `npm run mcp`.

## Registered tools

`read-dashboard` accepts `scope` as `all`, `data`, `cards`, `presentation`,
`integrations`, or `roles`.

The write tools correspond to the contract mutations:

- `patch-card-state`
- `add-card`, `edit-card`, `remove-card`
- `insert-card`, `edit-dashboard`
- `add-theme`, `edit-theme`, `remove-theme`, `set-font-scale`
- `add-integration`, `edit-integration`, `remove-integration`

The service validates each mutation and enforces the required permission level.
MCP does not read or write data files, refresh integrations, perform path
containment, or implement a second permission check.
