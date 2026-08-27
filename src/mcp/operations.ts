import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import {
  parseDashboardConfiguration,
  type AgentAccess,
  type DashboardConfiguration,
} from "../dashboard";
import {
  readDashboardConfiguration,
  replaceDashboardConfiguration,
} from "../server/dashboard-store";
import {
  pullGoogleCalendar,
  type FetchCalendar,
  type GoogleCalendarTokenProvider,
} from "../server/integrations/google-calendar";

export interface DashboardMcpDependencies {
  tokenProvider: GoogleCalendarTokenProvider;
  fetch?: FetchCalendar;
}

export interface DashboardMcpPaths {
  configurationPath?: string;
  calendarDataPath?: string;
}

function requireAccess(access: AgentAccess, operation: "read" | "write") {
  if (access === "none" || (operation === "write" && access !== "write")) {
    throw new Error(`Agent permission does not allow ${operation}`);
  }
}

export function createDashboardOperations(
  workspacePath: string,
  dependencies: DashboardMcpDependencies = {
    tokenProvider: async () => {
      throw new Error("Google Calendar credentials are not configured");
    },
  },
  paths: DashboardMcpPaths = {},
) {
  const workspace = resolve(workspacePath);
  const configurationPath =
    paths.configurationPath ?? join(workspace, "dashboard.json");
  const calendarDataPath =
    paths.calendarDataPath ?? join(workspace, "google-calendar.json");

  function artifactPath(path: string) {
    const target = resolve(workspace, path);
    const scoped = relative(workspace, target);
    if (!scoped || scoped.startsWith(`..${sep}`) || isAbsolute(scoped)) {
      throw new Error("Path must stay inside the dashboard workspace");
    }
    if (target.toLowerCase() === configurationPath.toLowerCase()) {
      throw new Error(
        "Use dashboard configuration operations for dashboard.json",
      );
    }
    return { target, scoped };
  }

  async function permissions() {
    return (await readDashboardConfiguration(configurationPath))
      .agentPermissions;
  }

  return {
    async refreshGoogleCalendar(): Promise<unknown> {
      const configuration = await readDashboardConfiguration(configurationPath);
      requireAccess(configuration.agentPermissions.data, "write");
      return pullGoogleCalendar({
        ...dependencies,
        configurationPath,
        dataPath: calendarDataPath,
      });
    },
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
