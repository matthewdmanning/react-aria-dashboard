import { join, resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

import {
  createDashboardOperations,
  type DashboardMcpDependencies,
  type DashboardMcpPaths,
} from "./operations";

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
    "draft-schema",
    {
      description:
        "Start or update a panel draft's JSON Schema, title, and sources.",
      inputSchema: z.object({
        id: z.string(),
        title: z.string(),
        sources: z.array(z.string()),
        schema: z.string(),
      }),
    },
    async ({ id, title, sources, schema }) =>
      result(JSON.stringify(await operations.draftSchema(id, title, sources, schema))),
  );
  server.registerTool(
    "draft-component",
    {
      description:
        "Set a panel draft's UI component. Rejects non-RAC primitives and non-theme-token styling.",
      inputSchema: z.object({ id: z.string(), component: z.string() }),
    },
    async ({ id, component }) =>
      result(JSON.stringify(await operations.draftComponent(id, component))),
  );
  server.registerTool(
    "draft-formatter",
    {
      description:
        "Set a panel draft's optional formatter, used when source data doesn't already match the schema.",
      inputSchema: z.object({ id: z.string(), formatter: z.string() }),
    },
    async ({ id, formatter }) =>
      result(JSON.stringify(await operations.draftFormatter(id, formatter))),
  );
  server.registerTool(
    "add-panel",
    {
      description:
        "Commit a new panel from its draft and wire it into the dashboard.",
      inputSchema: z.object({ id: z.string() }),
    },
    async ({ id }) => {
      await operations.addPanel(id);
      return result("Panel added");
    },
  );
  server.registerTool(
    "edit-panel",
    {
      description: "Commit draft changes over an existing panel.",
      inputSchema: z.object({ id: z.string() }),
    },
    async ({ id }) => {
      await operations.editPanel(id);
      return result("Panel edited");
    },
  );
  server.registerTool(
    "remove-panel",
    {
      description:
        "Delete a panel and prune its dashboard wiring and arrangement.",
      inputSchema: z.object({ id: z.string() }),
    },
    async ({ id }) => {
      await operations.removePanel(id);
      return result("Panel removed");
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
