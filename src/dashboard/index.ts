import { createElement, type ComponentType, type ReactElement } from "react";
import * as z from "zod/v4";

export type JsonSchema = Record<string, unknown>;

export interface PanelDefinition<T = unknown> {
  schema: JsonSchema;
  Component: ComponentType<{ data: T }>;
}

export type AgentAccess = "none" | "read" | "write";

const dashboardConfigurationSchema = z
  .object({
    version: z.literal(1),
    integrations: z.array(
      z
        .object({
          id: z.string().min(1),
          type: z.string().min(1),
          settings: z.record(z.string(), z.unknown()),
        })
        .strict(),
    ),
    theme: z.string().min(1),
    fontScale: z.number().min(0.75).max(2),
    agentPermissions: z
      .object({
        configuration: z.enum(["none", "read", "write"]),
        artifacts: z.enum(["none", "read", "write"]),
        data: z.enum(["none", "read", "write"]),
      })
      .strict(),
    panels: z.array(
      z
        .object({
          id: z.string().min(1),
          title: z.string(),
          definition: z.string().min(1),
        })
        .strict(),
    ),
    wiring: z.array(
      z
        .object({
          panelId: z.string().min(1),
          source: z.string().min(1),
          formatter: z.string().min(1),
        })
        .strict(),
    ),
    arrangement: z.array(z.string().min(1)),
  })
  .strict();

export type DashboardConfiguration = z.infer<
  typeof dashboardConfigurationSchema
>;

export function parseDashboardConfiguration(
  candidate: unknown,
): DashboardConfiguration {
  const configuration = dashboardConfigurationSchema.parse(candidate);
  const panelIds = new Set(configuration.panels.map(({ id }) => id));
  const wiredIds = new Set(configuration.wiring.map(({ panelId }) => panelId));
  const arrangedIds = new Set(configuration.arrangement);

  if (
    panelIds.size !== configuration.panels.length ||
    wiredIds.size !== configuration.wiring.length ||
    arrangedIds.size !== configuration.arrangement.length ||
    configuration.panels.length !== configuration.wiring.length ||
    configuration.panels.length !== configuration.arrangement.length ||
    configuration.wiring.some(({ panelId }) => !panelIds.has(panelId)) ||
    configuration.arrangement.some((panelId) => !panelIds.has(panelId))
  ) {
    throw new Error("Invalid dashboard configuration: panel wiring is incomplete");
  }

  return configuration;
}

export interface DashboardRuntime {
  panelDefinitions: Record<string, PanelDefinition<any>>;
  sources: Record<string, unknown>;
  formatters: Record<string, (source: unknown) => unknown>;
}

export function renderDashboard(
  candidate: unknown,
  runtime: DashboardRuntime,
): ReactElement {
  const configuration = parseDashboardConfiguration(candidate);
  const panels = new Map(configuration.panels.map((panel) => [panel.id, panel]));
  const wiring = new Map(
    configuration.wiring.map((connection) => [connection.panelId, connection]),
  );

  return createElement(
    "main",
    {
      "data-theme": configuration.theme,
      style: { fontSize: `${configuration.fontScale}rem` },
    },
    ...configuration.arrangement.map((panelId) => {
      const panel = panels.get(panelId)!;
      const connection = wiring.get(panelId)!;
      const definition = runtime.panelDefinitions[panel.definition];
      const formatter = runtime.formatters[connection.formatter];

      if (!definition || !formatter || !(connection.source in runtime.sources)) {
        throw new Error(`Dashboard runtime is missing wiring for panel: ${panelId}`);
      }

      const data = formatter(runtime.sources[connection.source]);
      return createElement(
        "section",
        { key: panelId },
        createElement("h2", null, panel.title),
        createElement(definition.Component, { data }),
      );
    }),
  );
}
