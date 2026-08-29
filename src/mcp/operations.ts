import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import Ajv from "ajv";

import {
  compileFormatterSpec,
  defaultDashboardConfiguration,
  parseDashboardConfiguration,
  type AgentAccess,
  type DashboardConfiguration,
  type FormatterSpec,
} from "../dashboard";
import { panelKindSchemas } from "../dashboard/panel-kinds";
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

export interface PanelArgs {
  id: string;
  title: string;
  kind: string;
  source: string;
  formatter?: string;
  formatterSpec?: FormatterSpec;
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

  function resolveFormatterFunction(
    formatterKey: string,
    formatterSpecs: Record<string, FormatterSpec>,
  ): ((source: unknown) => unknown) | undefined {
    if (formatterKey === "identity") return (source) => source;
    const spec = formatterSpecs[formatterKey];
    return spec ? compileFormatterSpec(spec) : undefined;
  }

  async function validateAgainstKind(
    kind: string,
    source: string,
    formatterFunction: ((source: unknown) => unknown) | undefined,
  ) {
    const sourceData = await readSourceData(source);
    if (sourceData === undefined) return;
    if (!formatterFunction) return;
    const formatted = formatterFunction(sourceData);
    const ajv = new Ajv();
    const validate = ajv.compile(panelKindSchemas[kind as keyof typeof panelKindSchemas]);
    if (!validate(formatted)) {
      throw new Error(
        `Formatted data does not match the '${kind}' panel schema: ${ajv.errorsText(validate.errors)}`,
      );
    }
  }

  async function upsertPanel(
    args: PanelArgs,
    mode: "add" | "edit",
  ): Promise<void> {
    const configuration = await readConfiguration();
    requirePanelsAccess(configuration, "write");

    if (!(args.kind in panelKindSchemas)) {
      throw new Error(`Unknown panel kind '${args.kind}'`);
    }

    const alreadyExists = configuration.panels.some(
      (panel) => panel.id === args.id,
    );
    if (mode === "add" && alreadyExists) {
      throw new Error(`Panel '${args.id}' already exists; use edit-panel`);
    }
    if (mode === "edit" && !alreadyExists) {
      throw new Error(`Panel '${args.id}' does not exist; use add-panel`);
    }

    const formatterSpecs = { ...configuration.formatterSpecs };
    const formatterKey = args.formatterSpec
      ? (args.formatter ?? args.id)
      : (args.formatter ?? "identity");
    if (args.formatterSpec) formatterSpecs[formatterKey] = args.formatterSpec;

    await validateAgainstKind(
      args.kind,
      args.source,
      resolveFormatterFunction(formatterKey, formatterSpecs),
    );

    const panelEntry = { id: args.id, title: args.title, definition: args.kind };
    const wiringEntry = {
      panelId: args.id,
      source: args.source,
      formatter: formatterKey,
    };

    const nextConfiguration =
      mode === "add"
        ? {
            ...configuration,
            panels: [...configuration.panels, panelEntry],
            wiring: [...configuration.wiring, wiringEntry],
            arrangement: [...configuration.arrangement, args.id],
            formatterSpecs,
          }
        : {
            ...configuration,
            panels: configuration.panels.map((panel) =>
              panel.id === args.id ? panelEntry : panel,
            ),
            wiring: configuration.wiring.map((wiring) =>
              wiring.panelId === args.id ? wiringEntry : wiring,
            ),
            formatterSpecs,
          };

    parseDashboardConfiguration(nextConfiguration);
    await replaceDashboardConfiguration(configurationPath, nextConfiguration);
  }

  return {
    async addPanel(args: PanelArgs): Promise<void> {
      await upsertPanel(args, "add");
    },

    async editPanel(args: PanelArgs): Promise<void> {
      await upsertPanel(args, "edit");
    },

    async removePanel(id: string): Promise<void> {
      const configuration = await readConfiguration();
      requirePanelsAccess(configuration, "write");
      if (!configuration.panels.some((panel) => panel.id === id)) {
        throw new Error(`Panel '${id}' does not exist`);
      }

      const removedFormatter = configuration.wiring.find(
        (wiring) => wiring.panelId === id,
      )?.formatter;
      const remainingWiring = configuration.wiring.filter(
        (wiring) => wiring.panelId !== id,
      );
      const formatterStillUsed = remainingWiring.some(
        (wiring) => wiring.formatter === removedFormatter,
      );
      const formatterSpecs = { ...configuration.formatterSpecs };
      if (removedFormatter && !formatterStillUsed) {
        delete formatterSpecs[removedFormatter];
      }

      await replaceDashboardConfiguration(configurationPath, {
        ...configuration,
        panels: configuration.panels.filter((panel) => panel.id !== id),
        wiring: remainingWiring,
        arrangement: configuration.arrangement.filter(
          (panelId) => panelId !== id,
        ),
        formatterSpecs,
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
