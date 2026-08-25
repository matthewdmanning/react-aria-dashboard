import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { renderToStaticMarkup } from "react-dom/server";
import * as z from "zod/v4";

import {
  componentDefinitions,
  type ComponentDefinitionName,
  type DashboardConfiguration,
  parseDashboardConfiguration,
  renderRegisteredComponent,
} from "../dashboard/index";
import { readDashboard, replaceDashboard } from "./dashboard-store";
import { pullPublicGoogleCalendar } from "./integrations/google-calendar";

export interface DashboardConfigurationProposal {
  id: string;
  baseRevision: string;
  configuration: DashboardConfiguration;
  preview: string;
}

function revision(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function proposeDashboardConfiguration(
  path: string,
  candidate: unknown,
): Promise<DashboardConfigurationProposal> {
  const baseRevision = revision(await readFile(path, "utf8"));
  const serialized = JSON.stringify(candidate);
  if (serialized === undefined) {
    throw new Error("Invalid dashboard configuration: value must be JSON");
  }
  const configuration = parseDashboardConfiguration(JSON.parse(serialized));
  const preview = JSON.stringify(configuration, null, 2);

  return {
    id: revision(`${baseRevision}\0${preview}`),
    baseRevision,
    configuration,
    preview,
  };
}

export async function approveDashboardConfiguration(
  path: string,
  proposal: DashboardConfigurationProposal,
): Promise<void> {
  if (revision(await readFile(path, "utf8")) !== proposal.baseRevision) {
    throw new Error("Dashboard changed after preview");
  }
  await replaceDashboard(path, proposal.configuration);
}

export function inspectComponentDefinitions() {
  return Object.entries(componentDefinitions).map(([name, definition]) => ({
    name,
    schema: definition.schema,
  }));
}

export function previewComponent(
  definition: ComponentDefinitionName,
  data: unknown,
) {
  return renderToStaticMarkup(
    renderRegisteredComponent(definition, data),
  );
}

export function createDashboardMcpServer(
  dashboardPath = process.env.DASHBOARD_DATA_PATH,
  calendarAccessKey = process.env.GOOGLE_CALENDAR_API_KEY,
) {
  const proposals = new Map<string, DashboardConfigurationProposal>();
  const server = new McpServer(
    { name: "personal-dashboard", version: "0.0.0" },
    {
      instructions:
        "Inspect before proposing. Preview tools never change persisted files; only explicit proposal approval does.",
    },
  );

  server.registerTool(
    "inspect-component-definitions",
    {
      description: "List available dashboard component definitions and schemas.",
      inputSchema: z.object({}),
    },
    async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(inspectComponentDefinitions()),
        },
      ],
    }),
  );

  server.registerTool(
    "preview-component",
    {
      description:
        "Validate unknown JSON against a component definition and return its static HTML preview.",
      inputSchema: z.object({
        definition: z.enum([
          "message",
          "table",
          "cards",
          "checklist",
          "calendar",
          "chart",
        ]),
        data: z.unknown(),
      }),
    },
    async ({ definition, data }) => {
      try {
        return {
          content: [
            { type: "text" as const, text: previewComponent(definition, data) },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: error instanceof Error ? error.message : "Preview failed",
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "inspect-dashboard-configuration",
    {
      description: "Read the current persisted dashboard configuration.",
      inputSchema: z.object({}),
    },
    async () => {
      if (!dashboardPath) {
        return {
          content: [{ type: "text" as const, text: "Dashboard path not configured" }],
          isError: true,
        };
      }
      try {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(await readDashboard(dashboardPath)),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: error instanceof Error ? error.message : "Inspection failed",
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "propose-dashboard-configuration",
    {
      description:
        "Validate and preview a complete dashboard configuration without changing persisted data.",
      inputSchema: z.object({ configuration: z.unknown() }),
    },
    async ({ configuration }) => {
      if (!dashboardPath) {
        return {
          content: [{ type: "text" as const, text: "Dashboard path not configured" }],
          isError: true,
        };
      }
      try {
        const proposal = await proposeDashboardConfiguration(
          dashboardPath,
          configuration,
        );
        proposals.set(proposal.id, proposal);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                proposalId: proposal.id,
                baseRevision: proposal.baseRevision,
                preview: proposal.preview,
              }),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: error instanceof Error ? error.message : "Proposal failed",
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "approve-dashboard-proposal",
    {
      description: "Apply a previously previewed dashboard proposal.",
      inputSchema: z.object({ proposalId: z.string() }),
    },
    async ({ proposalId }) => {
      const proposal = proposals.get(proposalId);
      if (!dashboardPath || !proposal) {
        return {
          content: [{ type: "text" as const, text: "Proposal not found" }],
          isError: true,
        };
      }
      try {
        await approveDashboardConfiguration(dashboardPath, proposal);
        proposals.delete(proposalId);
        return {
          content: [{ type: "text" as const, text: "Proposal approved" }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: error instanceof Error ? error.message : "Approval failed",
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "reject-dashboard-proposal",
    {
      description: "Discard a dashboard proposal without changing persisted data.",
      inputSchema: z.object({ proposalId: z.string() }),
    },
    async ({ proposalId }) => ({
      content: [
        {
          type: "text" as const,
          text: proposals.delete(proposalId)
            ? "Proposal rejected"
            : "Proposal not found",
        },
      ],
    }),
  );

  server.registerTool(
    "pull-public-google-calendar",
    {
      description:
        "Pull events from a public Google Calendar into a configured local data source without OAuth.",
      inputSchema: z.object({
        dataSourceId: z.string(),
        calendarId: z.string(),
        timeMin: z.string().optional(),
        timeMax: z.string().optional(),
      }),
    },
    async ({ dataSourceId, calendarId, timeMin, timeMax }) => {
      if (!dashboardPath || !calendarAccessKey) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Dashboard path or Google Calendar API key not configured",
            },
          ],
          isError: true,
        };
      }
      try {
        const data = await pullPublicGoogleCalendar({
          dashboardPath,
          dataSourceId,
          calendarId,
          accessKey: calendarAccessKey,
          timeMin,
          timeMax,
        });
        return {
          content: [
            {
              type: "text" as const,
              text: `Retained ${data.events.length} calendar events locally`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text:
                error instanceof Error ? error.message : "Calendar pull failed",
            },
          ],
          isError: true,
        };
      }
    },
  );

  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void serveStdio(createDashboardMcpServer);
  console.error("Personal Dashboard MCP server running on stdio");
}
