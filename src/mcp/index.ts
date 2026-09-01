import { join, resolve } from "node:path";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createFilePersistence, createService } from "../service";
import { createDashboardMcpServer } from "./server";

const workspace = resolve(process.env.DASHBOARD_WORKSPACE ?? process.cwd());
const dashboardPath =
  process.env.DASHBOARD_DATA_PATH ??
  join(workspace, ".dashboard", "dashboard.json");
const service = createService({
  persistence: createFilePersistence(dashboardPath),
});

void serveStdio(() => createDashboardMcpServer(service));
