import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createDashboardMcpServer } from "./server";

// MCP tooling placeholder: add future transports and tool registration here.
void serveStdio(() => createDashboardMcpServer());
