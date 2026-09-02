import * as z from "zod/v4";

import { cardTemplateSchemas, type CardTemplateName } from "./card-templates";

export { cardTemplateSchemas, type CardTemplateName };

const cardTemplateNameSchema = z.enum(
  Object.keys(cardTemplateSchemas) as [CardTemplateName, ...CardTemplateName[]],
);

const permissionLevelSchema = z.enum(["none", "read", "edit", "write"]);

export type PermissionLevel = z.infer<typeof permissionLevelSchema>;

export const permissionCategorySchema = z.enum([
  "data",
  "cards",
  "presentation",
  "integrations",
  "roles",
]);

export type PermissionCategory = z.infer<typeof permissionCategorySchema>;

export const permissionBundleSchema = z
  .object({
    data: permissionLevelSchema,
    cards: permissionLevelSchema,
    presentation: permissionLevelSchema,
    integrations: permissionLevelSchema,
    roles: permissionLevelSchema,
  })
  .strict();

export type PermissionBundle = z.infer<typeof permissionBundleSchema>;

export const roleSchema = z
  .object({
    name: z.string().min(1),
    permissions: permissionBundleSchema,
  })
  .strict();

export type Role = z.infer<typeof roleSchema>;

const credentialKey =
  /credential|password|secret|token|api.?key|access.?key/i;

export const integrationSchema = z
  .object({
    id: z.string().min(1),
    type: z.string().min(1),
    settings: z.record(z.string(), z.unknown()),
  })
  .strict()
  .superRefine(({ settings }, context) => {
    if (Object.keys(settings).some((key) => credentialKey.test(key))) {
      context.addIssue({
        code: "custom",
        path: ["settings"],
        message: "Integration credentials are not allowed",
      });
    }
  });

export type Integration = z.infer<typeof integrationSchema>;

export const themeSchema = z
  .object({
    id: z.string().min(1),
    settings: z.record(z.string(), z.unknown()),
  })
  .strict();

export type Theme = z.infer<typeof themeSchema>;

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

export const querySchema = z
  .object({
    integration: z.string().min(1),
    query: z.unknown(),
    formatter: formatterSpecSchema,
  })
  .strict();

export type Query = z.infer<typeof querySchema>;

export const cardSchema = z
  .object({
    id: z.string().min(1),
    title: z.string(),
    template: cardTemplateNameSchema,
    state: z.unknown(),
    queries: z.array(querySchema),
  })
  .strict();

export type Card = z.infer<typeof cardSchema>;

export const dashboardSchema = z
  .object({
    id: z.string().min(1),
    cards: z.array(z.string().min(1)),
    theme: z.string().min(1),
  })
  .strict();

export type Dashboard = z.infer<typeof dashboardSchema>;

export const dashboardConfigurationSchema = z
  .object({
    integrations: z.array(integrationSchema),
    themes: z.array(themeSchema),
    dashboard: dashboardSchema,
    fontScale: z.number().min(0.75).max(2),
    roles: z.array(roleSchema),
    cards: z.array(cardSchema),
  })
  .strict();

/**
 * What `read("all")` returns: the categories the caller may read, with the rest
 * omitted. Parsing a projection with the full schema would reject a caller who
 * is denied one category, which is what omitting rather than failing avoids.
 */
export const readableDashboardSchema = dashboardConfigurationSchema.partial();

export type ReadableDashboard = z.infer<typeof readableDashboardSchema>;

export type DashboardConfiguration = z.infer<
  typeof dashboardConfigurationSchema
>;

const cardStateMutationSchema = z
  .object({
    type: z.literal("patch-card-state"),
    permission: z.literal("data"),
    cardId: z.string().min(1),
    patch: z.unknown(),
  })
  .strict();

const addCardMutationSchema = z
  .object({
    type: z.literal("add-card"),
    permission: z.literal("cards"),
    card: cardSchema,
  })
  .strict();

const editCardMutationSchema = z
  .object({
    type: z.literal("edit-card"),
    permission: z.literal("cards"),
    card: cardSchema,
  })
  .strict();

const removeCardMutationSchema = z
  .object({
    type: z.literal("remove-card"),
    permission: z.literal("cards"),
    cardId: z.string().min(1),
  })
  .strict();

const insertCardMutationSchema = z
  .object({
    type: z.literal("insert-card"),
    permission: z.literal("presentation"),
    dashboardId: z.string().min(1),
    cardId: z.string().min(1),
    index: z.number().int().nonnegative().optional(),
  })
  .strict();

const editDashboardMutationSchema = z
  .object({
    type: z.literal("edit-dashboard"),
    permission: z.literal("presentation"),
    dashboard: dashboardSchema,
  })
  .strict();

const addThemeMutationSchema = z
  .object({
    type: z.literal("add-theme"),
    permission: z.literal("presentation"),
    theme: themeSchema,
  })
  .strict();

const editThemeMutationSchema = z
  .object({
    type: z.literal("edit-theme"),
    permission: z.literal("presentation"),
    theme: themeSchema,
  })
  .strict();

const setFontScaleMutationSchema = z
  .object({
    type: z.literal("set-font-scale"),
    permission: z.literal("presentation"),
    fontScale: z.number().min(0.75).max(2),
  })
  .strict();

const addIntegrationMutationSchema = z
  .object({
    type: z.literal("add-integration"),
    permission: z.literal("integrations"),
    integration: integrationSchema,
  })
  .strict();

const editIntegrationMutationSchema = z
  .object({
    type: z.literal("edit-integration"),
    permission: z.literal("integrations"),
    integration: integrationSchema,
  })
  .strict();

const removeIntegrationMutationSchema = z
  .object({
    type: z.literal("remove-integration"),
    permission: z.literal("integrations"),
    integrationId: z.string().min(1),
  })
  .strict();

const removeThemeMutationSchema = z
  .object({
    type: z.literal("remove-theme"),
    permission: z.literal("presentation"),
    themeId: z.string().min(1),
  })
  .strict();

export const mutationSchema = z.discriminatedUnion("type", [
  cardStateMutationSchema,
  addCardMutationSchema,
  editCardMutationSchema,
  removeCardMutationSchema,
  insertCardMutationSchema,
  editDashboardMutationSchema,
  addThemeMutationSchema,
  editThemeMutationSchema,
  removeThemeMutationSchema,
  setFontScaleMutationSchema,
  addIntegrationMutationSchema,
  editIntegrationMutationSchema,
  removeIntegrationMutationSchema,
]);

export type Mutation = z.infer<typeof mutationSchema>;
export const mutationsSchema = z.array(mutationSchema).min(1);

export const defaultDashboardConfiguration: DashboardConfiguration = {
  integrations: [],
  themes: [{ id: "calm", settings: {} }],
  dashboard: { id: "home", cards: ["welcome"], theme: "calm" },
  fontScale: 1,
  roles: [
    {
      name: "local",
      permissions: {
        data: "write",
        cards: "write",
        presentation: "write",
        integrations: "write",
        roles: "none",
      },
    },
  ],
  cards: [
    {
      id: "welcome",
      title: "Dashboard",
      template: "message",
      state: { message: "Welcome to your dashboard." },
      queries: [],
    },
  ],
};

function assertUnique(values: string[], label: string): void {
  if (new Set(values).size !== values.length) {
    throw new Error(`Invalid dashboard configuration: duplicate ${label}`);
  }
}

export function parseDashboardConfiguration(
  candidate: unknown,
): DashboardConfiguration {
  const configuration = dashboardConfigurationSchema.parse(candidate);

  assertUnique(
    configuration.integrations.map(({ id }) => id),
    "integration id",
  );
  assertUnique(
    configuration.themes.map(({ id }) => id),
    "theme id",
  );
  assertUnique(
    configuration.cards.map(({ id }) => id),
    "card id",
  );
  assertUnique(
    configuration.roles.map(({ name }) => name),
    "role name",
  );

  const cardIds = new Set(configuration.cards.map(({ id }) => id));
  const themeIds = new Set(configuration.themes.map(({ id }) => id));
  const integrationIds = new Set(
    configuration.integrations.map(({ id }) => id),
  );

  const { dashboard } = configuration;
  assertUnique(
    dashboard.cards,
    `card reference in dashboard '${dashboard.id}'`,
  );
  if (!themeIds.has(dashboard.theme)) {
    throw new Error(
      `Invalid dashboard configuration: dashboard '${dashboard.id}' references unknown theme '${dashboard.theme}'`,
    );
  }
  for (const cardId of dashboard.cards) {
    if (!cardIds.has(cardId)) {
      throw new Error(
        `Invalid dashboard configuration: dashboard '${dashboard.id}' references unknown card '${cardId}'`,
      );
    }
  }

  for (const card of configuration.cards) {
    for (const query of card.queries) {
      if (!integrationIds.has(query.integration)) {
        throw new Error(
          `Invalid dashboard configuration: card '${card.id}' references unknown integration '${query.integration}'`,
        );
      }
    }

    const state = cardTemplateSchemas[card.template].safeParse(card.state);
    if (!state.success) {
      throw new Error(
        `Invalid dashboard configuration: card '${card.id}' state does not fit card template '${card.template}': ${z.prettifyError(state.error)}`,
      );
    }
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
): [present: true, value: unknown] | [present: false] {
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
): (input: unknown) => unknown {
  if (spec.shape === "object") {
    return (input) => applyFields(input, spec.fields);
  }

  return (input) => {
    let array: unknown;
    for (const path of spec.from) {
      array = resolvePath(input, path);
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
