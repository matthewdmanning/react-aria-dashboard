import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import {
  compileFormatterSpec,
  defaultDashboardConfiguration,
  parseDashboardConfiguration,
  type AgentAccess,
  type DashboardConfiguration,
  type FormatterSpec,
} from "../dashboard";
import { cardTemplateSchemas } from "../dashboard/card-templates";
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

export interface CardArgs {
  id: string;
  title: string;
  template: string;
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

  function requireCardsAccess(
    configuration: DashboardConfiguration,
    operation: "read" | "write",
  ) {
    requireAccess(configuration.agentPermissions.cards, operation);
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

  async function validateAgainstTemplate(
    template: string,
    source: string,
    formatterFunction: ((source: unknown) => unknown) | undefined,
  ) {
    const sourceData = await readSourceData(source);
    if (sourceData === undefined) return;
    if (!formatterFunction) return;
    const formatted = formatterFunction(sourceData);
    const result =
      cardTemplateSchemas[template as keyof typeof cardTemplateSchemas].safeParse(
        formatted,
      );
    if (!result.success) {
      throw new Error(
        `Formatted data does not match the '${template}' card schema: ${result.error.message}`,
      );
    }
  }

  async function upsertCard(
    args: CardArgs,
    mode: "add" | "edit",
  ): Promise<void> {
    const configuration = await readConfiguration();
    requireCardsAccess(configuration, "write");

    if (!(args.template in cardTemplateSchemas)) {
      throw new Error(`Unknown card template '${args.template}'`);
    }

    const alreadyExists = configuration.cards.some(
      (card) => card.id === args.id,
    );
    if (mode === "add" && alreadyExists) {
      throw new Error(`Card '${args.id}' already exists; use edit-card`);
    }
    if (mode === "edit" && !alreadyExists) {
      throw new Error(`Card '${args.id}' does not exist; use add-card`);
    }

    const formatterSpecs = { ...configuration.formatterSpecs };
    const formatterKey = args.formatterSpec
      ? (args.formatter ?? args.id)
      : (args.formatter ?? "identity");
    if (args.formatterSpec) formatterSpecs[formatterKey] = args.formatterSpec;

    await validateAgainstTemplate(
      args.template,
      args.source,
      resolveFormatterFunction(formatterKey, formatterSpecs),
    );

    const cardEntry = {
      id: args.id,
      title: args.title,
      definition: args.template,
    };
    const wiringEntry = {
      cardId: args.id,
      source: args.source,
      formatter: formatterKey,
    };

    const nextConfiguration =
      mode === "add"
        ? {
            ...configuration,
            cards: [...configuration.cards, cardEntry],
            wiring: [...configuration.wiring, wiringEntry],
            arrangement: [...configuration.arrangement, args.id],
            formatterSpecs,
          }
        : {
            ...configuration,
            cards: configuration.cards.map((card) =>
              card.id === args.id ? cardEntry : card,
            ),
            wiring: configuration.wiring.map((wiring) =>
              wiring.cardId === args.id ? wiringEntry : wiring,
            ),
            formatterSpecs,
          };

    parseDashboardConfiguration(nextConfiguration);
    await replaceDashboardConfiguration(configurationPath, nextConfiguration);
  }

  return {
    async addCard(args: CardArgs): Promise<void> {
      await upsertCard(args, "add");
    },

    async editCard(args: CardArgs): Promise<void> {
      await upsertCard(args, "edit");
    },

    async removeCard(id: string): Promise<void> {
      const configuration = await readConfiguration();
      requireCardsAccess(configuration, "write");
      if (!configuration.cards.some((card) => card.id === id)) {
        throw new Error(`Card '${id}' does not exist`);
      }

      const removedFormatter = configuration.wiring.find(
        (wiring) => wiring.cardId === id,
      )?.formatter;
      const remainingWiring = configuration.wiring.filter(
        (wiring) => wiring.cardId !== id,
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
        cards: configuration.cards.filter((card) => card.id !== id),
        wiring: remainingWiring,
        arrangement: configuration.arrangement.filter(
          (cardId) => cardId !== id,
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
