import { join, resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

import { formatterSpecSchema } from "../dashboard";
import {
  createDashboardOperations,
  type DashboardMcpDependencies,
  type DashboardMcpPaths,
} from "./operations";

const cardArgsSchema = z.object({
  id: z.string(),
  title: z.string(),
  template: z.string(),
  source: z.string(),
  formatter: z.string().optional(),
  formatterSpec: formatterSpecSchema.optional(),
});

function result(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

export function createDashboardMcpServer(
  workspacePath = process.env.DASHBOARD_WORKSPACE ?? process.cwd(),
  dependencies?: DashboardMcpDependencies,
  paths?: DashboardMcpPaths,
) {
  const workspace = resolve(workspacePath);
  const operations = createDashboardOperations(workspace, dependencies, {
    configurationPath:
      paths?.configurationPath ??
      process.env.DASHBOARD_DATA_PATH ??
      join(workspace, ".dashboard", "dashboard.json"),
    calendarDataPath:
      paths?.calendarDataPath ??
      process.env.DASHBOARD_CALENDAR_DATA_PATH ??
      join(workspace, ".dashboard", "google-calendar.json"),
  });
  const server = new McpServer({
    name: "personal-dashboard",
    version: "0.0.0",
  });

  server.registerTool(
    "add-card",
    {
      description:
        "Add a new card: pick a card template, a data source, and how to format it (identity, a named built-in, or a declarative formatterSpec).",
      inputSchema: cardArgsSchema,
    },
    async (args) => {
      await operations.addCard(args);
      return result("Card added");
    },
  );
  server.registerTool(
    "edit-card",
    {
      description: "Replace an existing card's template, source, and formatter.",
      inputSchema: cardArgsSchema,
    },
    async (args) => {
      await operations.editCard(args);
      return result("Card edited");
    },
  );
  server.registerTool(
    "remove-card",
    {
      description:
        "Delete a card and prune its dashboard wiring and arrangement.",
      inputSchema: z.object({ id: z.string() }),
    },
    async ({ id }) => {
      await operations.removeCard(id);
      return result("Card removed");
    },
  );

  server.registerTool(
    "refresh",
    {
      description:
        "Refresh a saved integration when data write access permits it.",
      inputSchema: z.object({ source: z.string() }),
    },
    async ({ source }) =>
      result(JSON.stringify(await operations.refreshSource(source))),
  );
  server.registerTool(
    "read-dashboard-settings",
    {
      description: "Read dashboard settings when Settings permits it.",
      inputSchema: z.object({}),
    },
    async () =>
      result(JSON.stringify(await operations.readDashboardSettings())),
  );
  server.registerTool(
    "edit-dashboard-settings",
    {
      description:
        "Replace dashboard settings while preserving Settings-owned agent permissions.",
      inputSchema: z.object({ configuration: z.unknown() }),
    },
    async ({ configuration }) => {
      await operations.editDashboardSettings(configuration);
      return result("Dashboard settings updated");
    },
  );
  server.registerTool(
    "read-data-file",
    {
      description: "Read a file under data/ when Settings permits it.",
      inputSchema: z.object({ path: z.string() }),
    },
    async ({ path }) => result(await operations.readDataFile(path)),
  );
  server.registerTool(
    "edit-data-file",
    {
      description: "Write a file under data/ when Settings permits it.",
      inputSchema: z.object({ path: z.string(), content: z.string() }),
    },
    async ({ path, content }) => {
      await operations.editDataFile(path, content);
      return result("Data file written");
    },
  );

  return server;
}
