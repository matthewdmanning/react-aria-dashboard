import { join, resolve } from "node:path";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createFileAuthStore } from "../auth";
import { createFilePersistence, createService } from "../service";
import { createDashboardMcpServer } from "./server";

const workspace = resolve(process.env.DASHBOARD_WORKSPACE ?? process.cwd());
const dashboardPath =
  process.env.DASHBOARD_DATA_PATH ??
  join(workspace, ".dashboard", "dashboard.json");
const authStorePath =
  process.env.DASHBOARD_AUTH_STORE_PATH ??
  join(workspace, ".dashboard", "accounts.json");
const service = createService({
  persistence: createFilePersistence(dashboardPath),
  authStore: createFileAuthStore(authStorePath),
});

void serveStdio(() => createDashboardMcpServer(service));
