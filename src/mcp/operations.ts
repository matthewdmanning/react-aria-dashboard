import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
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
import {
  validatePanelPackageManifest,
  type PanelPackageManifest,
} from "./panel-packages";

export interface DashboardMcpDependencies {
  tokenProvider: GoogleCalendarTokenProvider;
  fetch?: FetchCalendar;
}

export interface DashboardMcpPaths {
  configurationPath?: string;
  calendarDataPath?: string;
}

export interface PanelPackageFiles {
  manifest: PanelPackageManifest;
  schema: string;
  component: string;
  formatter?: string;
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

  function validatePanelPreview(files: PanelPackageFiles) {
    const manifest = validatePanelPackageManifest(files.manifest);
    if (
      manifest.schema !== "schema.json" ||
      manifest.component !== "panel.tsx"
    ) {
      throw new Error("Panel preview requires schema.json and panel.tsx");
    }
    const forbidden =
      /(?:import\s+.*from\s+|require\s*\()?['"](?:node:)?(?:child_process|fs|net|http|https|os|process)['"]/;
    if (
      forbidden.test(files.component) ||
      (files.formatter && forbidden.test(files.formatter))
    ) {
      throw new Error("Panel package uses a forbidden API");
    }
    JSON.parse(files.schema);
    return manifest;
  }

  return {
    async previewPanelPackage(files: PanelPackageFiles) {
      const manifest = validatePanelPreview(files);
      return { id: manifest.id, title: manifest.title, preview: true };
    },

    async applyPanelPackage(files: PanelPackageFiles): Promise<void> {
      const configuration = await readDashboardConfiguration(configurationPath);
      requireAccess(configuration.agentPermissions.configuration, "write");
      requireAccess(configuration.agentPermissions.artifacts, "write");
      const manifest = validatePanelPreview(files);
      const packageRoot = join(workspace, "panels", manifest.id);
      const temporaryRoot = `${packageRoot}.${process.pid}.tmp`;
      const panelConfiguration = {
        ...configuration,
        panels: [
          ...configuration.panels,
          {
            id: manifest.id,
            title: manifest.title,
            definition: manifest.id,
          },
        ],
        wiring: [
          ...configuration.wiring,
          {
            panelId: manifest.id,
            source: manifest.sources[0] ?? manifest.id,
            formatter: manifest.formatter ? manifest.id : "identity",
          },
        ],
        arrangement: [...configuration.arrangement, manifest.id],
      };
      parseDashboardConfiguration(panelConfiguration);
      await mkdir(temporaryRoot, { recursive: true });
      await writeFile(
        join(temporaryRoot, "panel.json"),
        `${JSON.stringify(manifest, null, 2)}\n`,
      );
      await writeFile(
        join(temporaryRoot, "schema.json"),
        `${files.schema.trim()}\n`,
      );
      await writeFile(join(temporaryRoot, "panel.tsx"), files.component);
      if (files.formatter)
        await writeFile(join(temporaryRoot, "formatter.ts"), files.formatter);
      let previousPackage: string | undefined;
      try {
        previousPackage = `${packageRoot}.${process.pid}.bak`;
        await rename(packageRoot, previousPackage).catch(() => undefined);
        await rename(temporaryRoot, packageRoot);
        await replaceDashboardConfiguration(
          configurationPath,
          panelConfiguration,
        );
        if (previousPackage)
          await rm(previousPackage, { recursive: true, force: true });
      } catch (error) {
        await rm(temporaryRoot, { recursive: true, force: true });
        await rm(packageRoot, { recursive: true, force: true });
        if (previousPackage)
          await rename(previousPackage, packageRoot).catch(() => undefined);
        throw error;
      }
    },

    async refreshSource(sourceId: string): Promise<unknown> {
      const configuration = await readDashboardConfiguration(configurationPath);
      requireAccess(configuration.agentPermissions.data, "write");
      const integration = configuration.integrations.find(
        (candidate) => candidate.id === sourceId,
      );
      if (!integration) throw new Error(`Unknown source ID: ${sourceId}`);

      switch (integration.type) {
        case "google-calendar":
          return pullGoogleCalendar({
            ...dependencies,
            configurationPath,
            dataPath: calendarDataPath,
            integrationId: sourceId,
          });
        default:
          throw new Error(`Unsupported integration type: ${integration.type}`);
      }
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
