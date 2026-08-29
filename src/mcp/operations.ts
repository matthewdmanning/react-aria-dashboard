import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import Ajv from "ajv";

import {
  defaultDashboardConfiguration,
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
import { validatePanelPackageManifest } from "./panel-packages";
import {
  advanceDraftStage,
  draftHasFile,
  draftStageAtLeast,
  panelDir,
  panelExists,
  readDraftFile,
  readDraftMeta,
  removeDraft,
  seedDraftFromLivePanel,
  writeDraftFile,
  writeDraftMeta,
} from "./draft-store";
import {
  formatPanelValidationErrors,
  validatePanelComponentGovernance,
} from "./panel-validation";

export interface DashboardMcpDependencies {
  tokenProvider: GoogleCalendarTokenProvider;
  fetch?: FetchCalendar;
}

export interface DashboardMcpPaths {
  configurationPath?: string;
  calendarDataPath?: string;
}

const forbiddenSource =
  /(?:import\s+.*from\s+|require\s*\()?['"](?:node:)?(?:child_process|fs|net|http|https|os|process)['"]/;

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

  function dataFilePath(path: string) {
    const dataRoot = join(workspace, "data");
    const target = resolve(dataRoot, path);
    const scoped = relative(dataRoot, target);
    if (!scoped || scoped.startsWith(`..${sep}`) || isAbsolute(scoped)) {
      throw new Error("Path must stay inside the dashboard data directory");
    }
    return { target, scoped };
  }

  async function readConfiguration(): Promise<DashboardConfiguration> {
    try {
      return await readDashboardConfiguration(configurationPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      await replaceDashboardConfiguration(
        configurationPath,
        defaultDashboardConfiguration,
      );
      return defaultDashboardConfiguration;
    }
  }

  function requirePanelsAccess(
    configuration: DashboardConfiguration,
    operation: "read" | "write",
  ) {
    requireAccess(configuration.agentPermissions.panels, operation);
  }

  async function readSourceData(sourceId: string): Promise<unknown> {
    try {
      return JSON.parse(
        await readFile(dataFilePath(`${sourceId}.json`).target, "utf8"),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }

  async function requireFormatterIfSchemaMismatched(
    schema: string,
    sources: string[],
    hasFormatter: boolean,
  ) {
    if (hasFormatter || sources.length === 0) return;
    const sourceData = await readSourceData(sources[0]);
    if (sourceData === undefined) return;
    const ajv = new Ajv();
    const validate = ajv.compile(JSON.parse(schema) as object);
    if (!validate(sourceData)) {
      throw new Error(
        "Panel schema does not match its source data; call draft-formatter to reshape it",
      );
    }
  }

  async function commitDraft(id: string, mode: "add" | "edit"): Promise<void> {
    const configuration = await readConfiguration();
    requirePanelsAccess(configuration, "write");

    await seedDraftFromLivePanel(workspace, id);
    const draftMeta = await readDraftMeta(workspace, id);
    if (!draftStageAtLeast(draftMeta, "component")) {
      throw new Error(
        `No draft found for panel '${id}'; call draft-schema then draft-component first`,
      );
    }
    const meta = draftMeta!;
    const alreadyExists = await panelExists(workspace, id);
    if (mode === "add" && alreadyExists) {
      throw new Error(`Panel '${id}' already exists; use edit-panel`);
    }
    if (mode === "edit" && !alreadyExists) {
      throw new Error(`Panel '${id}' does not exist; use add-panel`);
    }

    const hasFormatter = await draftHasFile(workspace, id, "formatter.ts");
    const manifest = validatePanelPackageManifest({
      id,
      title: meta.title,
      schema: "schema.json",
      component: "panel.tsx",
      formatter: hasFormatter ? "formatter.ts" : undefined,
      sources: meta.sources,
    });

    const schema = await readDraftFile(workspace, id, "schema.json");
    await requireFormatterIfSchemaMismatched(
      schema,
      meta.sources,
      hasFormatter,
    );

    const packageRoot = panelDir(workspace, id);
    const temporaryRoot = `${packageRoot}.${process.pid}.tmp`;
    const panelEntry = {
      id: manifest.id,
      title: manifest.title,
      definition: manifest.id,
    };
    const wiringEntry = {
      panelId: manifest.id,
      source: manifest.sources[0] ?? manifest.id,
      formatter: manifest.formatter ? manifest.id : "identity",
    };
    const nextConfiguration =
      mode === "add"
        ? {
            ...configuration,
            panels: [...configuration.panels, panelEntry],
            wiring: [...configuration.wiring, wiringEntry],
            arrangement: [...configuration.arrangement, manifest.id],
          }
        : {
            ...configuration,
            panels: configuration.panels.map((panel) =>
              panel.id === id ? panelEntry : panel,
            ),
            wiring: configuration.wiring.map((wiring) =>
              wiring.panelId === id ? wiringEntry : wiring,
            ),
          };
    parseDashboardConfiguration(nextConfiguration);

    await mkdir(temporaryRoot, { recursive: true });
    await writeFile(
      join(temporaryRoot, "panel.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    await writeFile(join(temporaryRoot, "schema.json"), `${schema.trim()}\n`);
    await writeFile(
      join(temporaryRoot, "panel.tsx"),
      await readDraftFile(workspace, id, "panel.tsx"),
    );
    if (hasFormatter) {
      await writeFile(
        join(temporaryRoot, "formatter.ts"),
        await readDraftFile(workspace, id, "formatter.ts"),
      );
    }

    let previousPackage: string | undefined;
    try {
      previousPackage = `${packageRoot}.${process.pid}.bak`;
      await rename(packageRoot, previousPackage).catch(() => undefined);
      await rename(temporaryRoot, packageRoot);
      await replaceDashboardConfiguration(configurationPath, nextConfiguration);
      if (previousPackage)
        await rm(previousPackage, { recursive: true, force: true });
      await removeDraft(workspace, id);
    } catch (error) {
      await rm(temporaryRoot, { recursive: true, force: true });
      if (previousPackage) {
        await rm(packageRoot, { recursive: true, force: true });
        await rename(previousPackage, packageRoot).catch(() => undefined);
      }
      throw error;
    }
  }

  return {
    async draftSchema(
      id: string,
      title: string,
      sources: string[],
      schema: string,
    ): Promise<{ id: string; ok: true }> {
      const configuration = await readConfiguration();
      requirePanelsAccess(configuration, "write");
      await seedDraftFromLivePanel(workspace, id);
      JSON.parse(schema);
      await writeDraftFile(workspace, id, "schema.json", schema);
      const meta = await readDraftMeta(workspace, id);
      await writeDraftMeta(workspace, id, {
        title,
        sources,
        stage: advanceDraftStage(meta, "schema"),
      });
      return { id, ok: true };
    },

    async draftComponent(
      id: string,
      component: string,
    ): Promise<{ id: string; ok: true }> {
      const configuration = await readConfiguration();
      requirePanelsAccess(configuration, "write");
      await seedDraftFromLivePanel(workspace, id);
      const meta = await readDraftMeta(workspace, id);
      if (!draftStageAtLeast(meta, "schema")) {
        throw new Error(
          `draft-component requires draft-schema first for panel '${id}'`,
        );
      }
      if (forbiddenSource.test(component)) {
        throw new Error("Panel component uses a forbidden API");
      }
      const governanceErrors = validatePanelComponentGovernance(component);
      if (governanceErrors.length > 0) {
        throw new Error(formatPanelValidationErrors(governanceErrors));
      }
      await writeDraftFile(workspace, id, "panel.tsx", component);
      await writeDraftMeta(workspace, id, {
        ...meta!,
        stage: advanceDraftStage(meta, "component"),
      });
      return { id, ok: true };
    },

    async draftFormatter(
      id: string,
      formatter: string,
    ): Promise<{ id: string; ok: true }> {
      const configuration = await readConfiguration();
      requirePanelsAccess(configuration, "write");
      await seedDraftFromLivePanel(workspace, id);
      const meta = await readDraftMeta(workspace, id);
      if (!draftStageAtLeast(meta, "component")) {
        throw new Error(
          `draft-formatter requires draft-component first for panel '${id}'`,
        );
      }
      if (forbiddenSource.test(formatter)) {
        throw new Error("Panel formatter uses a forbidden API");
      }
      await writeDraftFile(workspace, id, "formatter.ts", formatter);
      await writeDraftMeta(workspace, id, {
        ...meta!,
        stage: advanceDraftStage(meta, "formatter"),
      });
      return { id, ok: true };
    },

    async addPanel(id: string): Promise<void> {
      await commitDraft(id, "add");
    },

    async editPanel(id: string): Promise<void> {
      await commitDraft(id, "edit");
    },

    async removePanel(id: string): Promise<void> {
      const configuration = await readConfiguration();
      requirePanelsAccess(configuration, "write");
      if (!(await panelExists(workspace, id))) {
        throw new Error(`Panel '${id}' does not exist`);
      }
      await rm(panelDir(workspace, id), { recursive: true, force: true });
      await removeDraft(workspace, id);
      await replaceDashboardConfiguration(configurationPath, {
        ...configuration,
        panels: configuration.panels.filter((panel) => panel.id !== id),
        wiring: configuration.wiring.filter((wiring) => wiring.panelId !== id),
        arrangement: configuration.arrangement.filter(
          (panelId) => panelId !== id,
        ),
      });
    },

    async refreshSource(sourceId: string): Promise<unknown> {
      const configuration = await readConfiguration();
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
    async readDashboardSettings(): Promise<DashboardConfiguration> {
      const configuration = await readConfiguration();
      requireAccess(configuration.agentPermissions.configuration, "read");
      return configuration;
    },

    async editDashboardSettings(candidate: unknown): Promise<void> {
      const current = await readConfiguration();
      requireAccess(current.agentPermissions.configuration, "write");
      const next = parseDashboardConfiguration(candidate);
      await replaceDashboardConfiguration(configurationPath, {
        ...next,
        agentPermissions: current.agentPermissions,
      });
    },

    async readDataFile(path: string): Promise<string> {
      const { target } = dataFilePath(path);
      const configuration = await readConfiguration();
      requireAccess(configuration.agentPermissions.data, "read");
      return readFile(target, "utf8");
    },

    async editDataFile(path: string, content: string): Promise<void> {
      const { target } = dataFilePath(path);
      const configuration = await readConfiguration();
      requireAccess(configuration.agentPermissions.data, "write");
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, content);
    },
  };
}
