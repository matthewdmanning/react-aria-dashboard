import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";

import {
  parseDashboardConfiguration,
  type AgentAccess,
  type DashboardConfiguration,
} from "../dashboard";
import {
  readDashboardConfiguration,
  replaceDashboardConfiguration,
} from "./dashboard-store";

function requireAccess(access: AgentAccess, operation: "read" | "write") {
  if (access === "none" || (operation === "write" && access !== "write")) {
    throw new Error(`Agent permission does not allow ${operation}`);
  }
}

export function createDashboardOperations(workspacePath: string) {
  const workspace = resolve(workspacePath);
  const configurationPath = join(workspace, "dashboard.json");

  function artifactPath(path: string) {
    const target = resolve(workspace, path);
    const scoped = relative(workspace, target);
    if (!scoped || scoped.startsWith(`..${sep}`) || isAbsolute(scoped)) {
      throw new Error("Path must stay inside the dashboard workspace");
    }
    if (target === configurationPath) {
      throw new Error("Use dashboard configuration operations for dashboard.json");
    }
    return { target, scoped };
  }

  async function permissions() {
    return (await readDashboardConfiguration(configurationPath)).agentPermissions;
  }

  return {
    async inspectConfiguration(): Promise<DashboardConfiguration> {
      const configuration = await readDashboardConfiguration(configurationPath);
      requireAccess(configuration.agentPermissions.configuration, "read");
      return configuration;
    },

    async replaceConfiguration(candidate: unknown): Promise<void> {
      const current = await readDashboardConfiguration(configurationPath);
      requireAccess(current.agentPermissions.configuration, "write");
      const next = parseDashboardConfiguration(candidate);
      await replaceDashboardConfiguration(configurationPath, {
        ...next,
        agentPermissions: current.agentPermissions,
      });
    },

    async readArtifact(path: string): Promise<string> {
      const { target, scoped } = artifactPath(path);
      const category = scoped.startsWith(`data${sep}`) ? "data" : "artifacts";
      requireAccess((await permissions())[category], "read");
      return readFile(target, "utf8");
    },

    async writeArtifact(path: string, content: string): Promise<void> {
      const { target, scoped } = artifactPath(path);
      const category = scoped.startsWith(`data${sep}`) ? "data" : "artifacts";
      requireAccess((await permissions())[category], "write");
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, content);
    },
  };
}

function result(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

export function createDashboardMcpServer(
  workspacePath = process.env.DASHBOARD_WORKSPACE ?? process.cwd(),
) {
  const operations = createDashboardOperations(workspacePath);
  const server = new McpServer({ name: "personal-dashboard", version: "0.0.0" });

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
      description: "Read a dashboard artifact or data file when Settings permits it.",
      inputSchema: z.object({ path: z.string() }),
    },
    async ({ path }) => result(await operations.readArtifact(path)),
  );
  server.registerTool(
    "write-dashboard-file",
    {
      description: "Write a dashboard artifact or data file when Settings permits it.",
      inputSchema: z.object({ path: z.string(), content: z.string() }),
    },
    async ({ path, content }) => {
      await operations.writeArtifact(path, content);
      return result("Dashboard file written");
    },
  );

  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void serveStdio(() => createDashboardMcpServer());
}
