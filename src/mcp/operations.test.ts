import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

import { defaultDashboardConfiguration } from "../dashboard";
import { replaceDashboardConfiguration } from "../server/dashboard-store";
import { createDashboardOperations } from "./operations";

describe("dashboard MCP operations contract", () => {
  test("performs permission-governed configuration and artifact work", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "dashboard-mcp-"));
    const configurationPath = join(workspace, "dashboard.json");
    const configuration = {
      ...defaultDashboardConfiguration,
      agentPermissions: {
        configuration: "write" as const,
        artifacts: "write" as const,
        data: "none" as const,
      },
    };
    await replaceDashboardConfiguration(configurationPath, configuration);
    const operations = createDashboardOperations(workspace);

    await expect(operations.inspectConfiguration()).resolves.toEqual(
      configuration,
    );
    await operations.replaceConfiguration({
      ...configuration,
      theme: "contrast",
    });
    await operations.writeArtifact(
      "panels/weather.tsx",
      "export const weather = true;\n",
    );

    await expect(operations.readArtifact("panels/weather.tsx")).resolves.toBe(
      "export const weather = true;\n",
    );
    await expect(operations.readArtifact("data/private.json")).rejects.toThrow(
      "permission",
    );
    await expect(
      operations.writeArtifact("../outside.txt", "no"),
    ).rejects.toThrow("workspace");
    expect(JSON.parse(await readFile(configurationPath, "utf8"))).toMatchObject(
      {
        theme: "contrast",
        agentPermissions: configuration.agentPermissions,
      },
    );
  });

  test("refreshes the saved Calendar only with data write permission", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "calendar-mcp-"));
    await replaceDashboardConfiguration(join(workspace, "dashboard.json"), {
      ...defaultDashboardConfiguration,
      integrations: [
        {
          id: "calendar",
          type: "google-calendar",
          settings: { calendarId: "team" },
        },
      ],
      agentPermissions: {
        configuration: "none",
        artifacts: "none",
        data: "write",
      },
    });
    const fetchCalendar = async (url: string) => {
      expect(url).toContain("team");
      return Response.json({ items: [{ id: "event-1" }] });
    };
    const operations = createDashboardOperations(workspace, {
      tokenProvider: async () => "access-token",
      fetch: fetchCalendar,
    });

    await expect(operations.refreshGoogleCalendar()).resolves.toEqual({
      items: [{ id: "event-1" }],
    });

    await replaceDashboardConfiguration(join(workspace, "dashboard.json"), {
      ...defaultDashboardConfiguration,
      integrations: [
        {
          id: "calendar",
          type: "google-calendar",
          settings: { calendarId: "team" },
        },
      ],
      agentPermissions: {
        configuration: "none",
        artifacts: "none",
        data: "read",
      },
    });
    await expect(operations.refreshGoogleCalendar()).rejects.toThrow(
      "permission",
    );
  });

  test("previews and then applies an approved panel package", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "panel-mcp-"));
    const configurationPath = join(workspace, "dashboard.json");
    await replaceDashboardConfiguration(configurationPath, {
      ...defaultDashboardConfiguration,
      agentPermissions: {
        configuration: "write",
        artifacts: "write",
        data: "none",
      },
    });
    const operations = createDashboardOperations(workspace);
    const files = {
      manifest: {
        id: "weather-panel",
        title: "Weather",
        schema: "schema.json",
        component: "panel.tsx",
        sources: ["weather"],
      },
      schema: JSON.stringify({
        type: "object",
        properties: { temperature: { type: "number" } },
        required: ["temperature"],
      }),
      component: "export function Panel({ data }) { return data.temperature; }",
    };

    await expect(operations.previewPanelPackage(files)).resolves.toEqual({
      id: "weather-panel",
      title: "Weather",
      preview: true,
    });
    await expect(readFile(join(workspace, "panels", "weather-panel", "panel.json"))).rejects.toThrow();

    await operations.applyPanelPackage(files);
    await expect(
      readFile(join(workspace, "panels", "weather-panel", "panel.tsx"), "utf8"),
    ).resolves.toBe(files.component);
    await expect(
      readFile(configurationPath, "utf8").then((contents) => JSON.parse(contents)),
    ).resolves.toMatchObject({
      panels: [{ id: "welcome" }, { id: "weather-panel" }],
      wiring: [{ panelId: "welcome" }, { panelId: "weather-panel" }],
    });
  });
});
