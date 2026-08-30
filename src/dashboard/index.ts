import { createElement, type ComponentType, type ReactElement } from "react";
import * as z from "zod/v4";

export interface CardTemplate<T = unknown> {
  schema: z.ZodType<T>;
  Component: ComponentType<{ data: T }>;
}

export type AgentAccess = "none" | "read" | "write";

const fieldSpecSchema = z
  .object({
    from: z.array(z.string().min(1)).min(1),
    default: z
      .union([z.string(), z.number(), z.boolean(), z.null()])
      .optional(),
    coerce: z.literal("string").optional(),
  })
  .strict();

export const formatterSpecSchema = z.discriminatedUnion("shape", [
  z
    .object({
      shape: z.literal("object"),
      fields: z.record(z.string(), fieldSpecSchema),
    })
    .strict(),
  z
    .object({
      shape: z.literal("array"),
      from: z.array(z.string().min(1)).min(1),
      into: z.string().min(1),
      fields: z.record(z.string(), fieldSpecSchema),
    })
    .strict(),
]);

export type FormatterSpec = z.infer<typeof formatterSpecSchema>;
type FieldSpec = z.infer<typeof fieldSpecSchema>;

const builtInFormatterNames = ["identity", "message", "google-calendar"];

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
        data: z.enum(["none", "read", "write"]),
        cards: z.enum(["none", "read", "write"]).default("none"),
      })
      .strict(),
    cards: z.array(
      z
        .object({
          id: z.string().min(1),
          title: z.string(),
          template: z.string().min(1),
        })
        .strict(),
    ),
    wiring: z.array(
      z
        .object({
          cardId: z.string().min(1),
          source: z.string().min(1),
          formatter: z.string().min(1),
        })
        .strict(),
    ),
    arrangement: z.array(z.string().min(1)),
    formatterSpecs: z.record(z.string(), formatterSpecSchema).default({}),
  })
  .strict();

export type DashboardConfiguration = z.infer<
  typeof dashboardConfigurationSchema
>;

export const defaultDashboardConfiguration: DashboardConfiguration = {
  version: 1,
  integrations: [],
  theme: "calm",
  fontScale: 1,
  agentPermissions: {
    configuration: "read",
    data: "none",
    cards: "none",
  },
  cards: [{ id: "welcome", title: "Dashboard", template: "message" }],
  wiring: [{ cardId: "welcome", source: "welcome", formatter: "message" }],
  arrangement: ["welcome"],
  formatterSpecs: {},
};

export function parseDashboardConfiguration(
  candidate: unknown,
): DashboardConfiguration {
  const configuration = dashboardConfigurationSchema.parse(candidate);
  const credentialKey =
    /credential|password|secret|token|api.?key|access.?key/i;
  if (
    configuration.integrations.some(({ settings }) =>
      Object.keys(settings).some((key) => credentialKey.test(key)),
    )
  ) {
    throw new Error(
      "Invalid dashboard configuration: integration credentials are not allowed",
    );
  }
  const cardIds = new Set(configuration.cards.map(({ id }) => id));
  const wiredIds = new Set(configuration.wiring.map(({ cardId }) => cardId));
  const arrangedIds = new Set(configuration.arrangement);

  if (
    cardIds.size !== configuration.cards.length ||
    wiredIds.size !== configuration.wiring.length ||
    arrangedIds.size !== configuration.arrangement.length ||
    configuration.cards.length !== configuration.wiring.length ||
    configuration.cards.length !== configuration.arrangement.length ||
    configuration.wiring.some(({ cardId }) => !cardIds.has(cardId)) ||
    configuration.arrangement.some((cardId) => !cardIds.has(cardId))
  ) {
    throw new Error(
      "Invalid dashboard configuration: card wiring is incomplete",
    );
  }

  if (
    configuration.wiring.some(
      ({ formatter }) =>
        !builtInFormatterNames.includes(formatter) &&
        !(formatter in configuration.formatterSpecs),
    )
  ) {
    throw new Error(
      "Invalid dashboard configuration: wiring references an unknown formatter",
    );
  }

  return configuration;
}

function resolvePath(root: unknown, path: string, index?: number): unknown {
  let value: unknown = root;
  for (const segment of path.split(".")) {
    if (segment === "$index") {
      value = index;
      continue;
    }
    if (value === null || typeof value !== "object") return undefined;
    value = (value as Record<string, unknown>)[segment];
  }
  return value;
}

function resolveField(
  root: unknown,
  spec: FieldSpec,
  index: number | undefined,
): [key: true, value: unknown] | [key: false] {
  for (const path of spec.from) {
    const value = resolvePath(root, path, index);
    if (value !== undefined && value !== null) {
      return [true, spec.coerce === "string" ? String(value) : value];
    }
  }
  if (spec.default !== undefined) {
    const value =
      typeof spec.default === "string" && index !== undefined
        ? spec.default.replace("$index", String(index))
        : spec.default;
    return [true, value];
  }
  return [false];
}

function applyFields(
  root: unknown,
  fields: Record<string, FieldSpec>,
  index?: number,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, spec] of Object.entries(fields)) {
    const [present, value] = resolveField(root, spec, index);
    if (present) result[key] = value;
  }
  return result;
}

export function compileFormatterSpec(
  spec: FormatterSpec,
): (source: unknown) => unknown {
  if (spec.shape === "object") {
    return (source) => applyFields(source, spec.fields);
  }
  return (source) => {
    let array: unknown;
    for (const path of spec.from) {
      array = resolvePath(source, path);
      if (array !== undefined && array !== null) break;
    }
    const sourceArray = Array.isArray(array) ? array : [];
    return {
      [spec.into]: sourceArray.map((item, index) =>
        applyFields(item, spec.fields, index),
      ),
    };
  };
}

export interface DashboardRuntime {
  cardTemplates: Record<string, CardTemplate<any>>;
  sources: Record<string, unknown>;
  formatters: Record<string, (source: unknown) => unknown>;
}

export function renderDashboard(
  candidate: unknown,
  runtime: DashboardRuntime,
): ReactElement {
  const configuration = parseDashboardConfiguration(candidate);
  const cards = new Map(configuration.cards.map((card) => [card.id, card]));
  const wiring = new Map(
    configuration.wiring.map((connection) => [connection.cardId, connection]),
  );

  return createElement(
    "main",
    {
      "data-theme": configuration.theme,
      style: { fontSize: `${configuration.fontScale}rem` },
    },
    ...configuration.arrangement.map((cardId) => {
      const card = cards.get(cardId)!;
      const connection = wiring.get(cardId)!;
      const template = runtime.cardTemplates[card.template];
      const formatter = runtime.formatters[connection.formatter];

      if (!template || !formatter || !(connection.source in runtime.sources)) {
        throw new Error(
          `Dashboard runtime is missing wiring for card: ${cardId}`,
        );
      }

      const data = formatter(runtime.sources[connection.source]);
      return createElement(
        "section",
        { key: cardId },
        createElement("h2", null, card.title),
        createElement(template.Component, { data }),
      );
    }),
  );
}
