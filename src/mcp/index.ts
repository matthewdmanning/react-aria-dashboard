import { join, resolve } from "node:path";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createFileAccountStore } from "../auth";
import { createFilePersistence, createService } from "../service";
import { createDashboardMcpServer } from "./server";

const workspace = resolve(process.env.DASHBOARD_WORKSPACE ?? process.cwd());
const dashboardPath =
  process.env.DASHBOARD_DATA_PATH ??
  join(workspace, ".dashboard", "dashboard.json");
const accountPath =
  process.env.DASHBOARD_ACCOUNT_PATH ??
  join(workspace, ".dashboard", "accounts.json");
const service = createService({
  persistence: createFilePersistence(dashboardPath),
  accountStore: createFileAccountStore(accountPath),
});

void serveStdio(() => createDashboardMcpServer(service));
