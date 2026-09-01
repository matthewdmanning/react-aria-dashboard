import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

import {
  cardSchema,
  dashboardSchema,
  integrationSchema,
  themeSchema,
  type Mutation,
} from "../contract";
import type { DashboardService } from "../service";

const readScopeSchema = z.enum([
  "all",
  "data",
  "cards",
  "presentation",
  "integrations",
  "roles",
]);

function result(text: string, isError = false) {
  return { content: [{ type: "text" as const, text }], isError };
}

/**
 * Service failures — denied permissions, unknown ids, refused removals — are
 * answers the caller can act on, so they come back as tool results rather than
 * protocol errors.
 */
async function reply(operation: () => Promise<string>) {
  try {
    return result(await operation());
  } catch (error) {
    return result(error instanceof Error ? error.message : String(error), true);
  }
}

export function createDashboardMcpServer(service: DashboardService) {
  const server = new McpServer({
    name: "personal-dashboard",
    version: "0.0.0",
  });

  const apply = (mutation: Mutation, message: string) =>
    reply(async () => {
      await service.apply([mutation]);
      return message;
    });

  server.registerTool(
    "read-dashboard",
    {
      description: "Read the dashboard state allowed by the caller's role.",
      inputSchema: z.object({
        scope: readScopeSchema.default("all"),
      }),
    },
    async ({ scope }) =>
      reply(async () => JSON.stringify(await service.read(scope))),
  );

  server.registerTool(
    "add-card",
    {
      description: "Add a new card.",
      inputSchema: z.object({ card: cardSchema }),
    },
    async ({ card }) =>
      apply({ type: "add-card", permission: "cards", card }, "Card added"),
  );
  server.registerTool(
    "edit-card",
    {
      description: "Replace an existing card.",
      inputSchema: z.object({ card: cardSchema }),
    },
    async ({ card }) =>
      apply({ type: "edit-card", permission: "cards", card }, "Card edited"),
  );
  server.registerTool(
    "remove-card",
    {
      description: "Delete a card.",
      inputSchema: z.object({ cardId: z.string() }),
    },
    async ({ cardId }) =>
      apply(
        { type: "remove-card", permission: "cards", cardId },
        "Card removed",
      ),
  );

  server.registerTool(
    "patch-card-state",
    {
      description: "Patch the state displayed by an existing card.",
      inputSchema: z.object({
        cardId: z.string(),
        patch: z.record(z.string(), z.unknown()),
      }),
    },
    async ({ cardId, patch }) =>
      apply(
        { type: "patch-card-state", permission: "data", cardId, patch },
        "Card state updated",
      ),
  );

  server.registerTool(
    "insert-card",
    {
      description: "Place an existing card on the dashboard.",
      inputSchema: z.object({
        cardId: z.string(),
        index: z.number().int().nonnegative().optional(),
      }),
    },
    async ({ cardId, index }) =>
      reply(async () => {
        const { dashboard } = await service.read("presentation");
        await service.apply([
          {
            type: "insert-card",
            permission: "presentation",
            dashboardId: dashboard.id,
            cardId,
            index,
          },
        ]);
        return "Card inserted";
      }),
  );

  server.registerTool(
    "edit-dashboard",
    {
      description: "Replace the dashboard document.",
      inputSchema: z.object({ dashboard: dashboardSchema }),
    },
    async ({ dashboard }) =>
      apply(
        { type: "edit-dashboard", permission: "presentation", dashboard },
        "Dashboard updated",
      ),
  );

  server.registerTool(
    "add-theme",
    {
      description: "Add a theme.",
      inputSchema: z.object({ theme: themeSchema }),
    },
    async ({ theme }) =>
      apply(
        { type: "add-theme", permission: "presentation", theme },
        "Theme added",
      ),
  );

  server.registerTool(
    "edit-theme",
    {
      description: "Replace an existing theme.",
      inputSchema: z.object({ theme: themeSchema }),
    },
    async ({ theme }) =>
      apply(
        { type: "edit-theme", permission: "presentation", theme },
        "Theme edited",
      ),
  );

  server.registerTool(
    "remove-theme",
    {
      description: "Delete an unused theme.",
      inputSchema: z.object({ themeId: z.string() }),
    },
    async ({ themeId }) =>
      apply(
        { type: "remove-theme", permission: "presentation", themeId },
        "Theme removed",
      ),
  );

  server.registerTool(
    "set-font-scale",
    {
      description: "Set the dashboard font scale.",
      inputSchema: z.object({ fontScale: z.number().min(0.75).max(2) }),
    },
    async ({ fontScale }) =>
      apply(
        { type: "set-font-scale", permission: "presentation", fontScale },
        "Font scale updated",
      ),
  );

  server.registerTool(
    "add-integration",
    {
      description: "Add an integration.",
      inputSchema: z.object({ integration: integrationSchema }),
    },
    async ({ integration }) =>
      apply(
        { type: "add-integration", permission: "integrations", integration },
        "Integration added",
      ),
  );

  server.registerTool(
    "edit-integration",
    {
      description: "Replace an existing integration.",
      inputSchema: z.object({ integration: integrationSchema }),
    },
    async ({ integration }) =>
      apply(
        { type: "edit-integration", permission: "integrations", integration },
        "Integration edited",
      ),
  );

  server.registerTool(
    "remove-integration",
    {
      description: "Delete an integration not used by a card.",
      inputSchema: z.object({ integrationId: z.string() }),
    },
    async ({ integrationId }) =>
      apply(
        {
          type: "remove-integration",
          permission: "integrations",
          integrationId,
        },
        "Integration removed",
      ),
  );

  return server;
}
