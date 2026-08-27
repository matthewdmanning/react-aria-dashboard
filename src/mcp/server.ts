import { join, resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

import {
  createDashboardOperations,
  type DashboardMcpDependencies,
  type PanelPackageFiles,
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
    "preview-panel-package",
    {
      description: "Validate an ephemeral panel package before user approval.",
      inputSchema: z.object({
        manifest: z.record(z.string(), z.unknown()),
        schema: z.string(),
        component: z.string(),
        formatter: z.string().optional(),
      }),
    },
    async (files) =>
      result(
        JSON.stringify(
          await operations.previewPanelPackage(files as PanelPackageFiles),
        ),
      ),
  );
  server.registerTool(
    "apply-panel-package",
    {
      description:
        "Persist an approved panel package and add its dashboard wiring.",
      inputSchema: z.object({
        manifest: z.record(z.string(), z.unknown()),
        schema: z.string(),
        component: z.string(),
        formatter: z.string().optional(),
      }),
    },
    async (files) => {
      await operations.applyPanelPackage(files as PanelPackageFiles);
      return result("Panel package applied");
    },
  );

  server.registerTool(
    "refresh-google-calendar",
    {
      description:
        "Pull the saved Google Calendar integration when data write access permits it.",
      inputSchema: z.object({}),
    },
    async () =>
      result(JSON.stringify(await operations.refreshGoogleCalendar())),
  );
  server.registerTool(
    "inspect-dashboard-configuration",
    {
      description: "Read dashboard configuration when Settings permits it.",
      inputSchema: z.object({}),
    },
    async () => result(JSON.stringify(await operations.inspectConfiguration())),
  );
  server.registerTool(
    "replace-dashboard-configuration",
    {
      description:
        "Replace dashboard configuration while preserving Settings-owned agent permissions.",
      inputSchema: z.object({ configuration: z.unknown() }),
    },
    async ({ configuration }) => {
      await operations.replaceConfiguration(configuration);
      return result("Dashboard configuration replaced");
    },
  );
  server.registerTool(
    "read-dashboard-file",
    {
      description:
        "Read a dashboard artifact or data file when Settings permits it.",
      inputSchema: z.object({ path: z.string() }),
    },
    async ({ path }) => result(await operations.readArtifact(path)),
  );
  server.registerTool(
    "write-dashboard-file",
    {
      description:
        "Write a dashboard artifact or data file when Settings permits it.",
      inputSchema: z.object({ path: z.string(), content: z.string() }),
    },
    async ({ path, content }) => {
      await operations.writeArtifact(path, content);
      return result("Dashboard file written");
    },
  );

  return server;
}
