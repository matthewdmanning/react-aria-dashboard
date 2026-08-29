import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

import { defaultDashboardConfiguration } from "../dashboard";
import { replaceDashboardConfiguration } from "../server/dashboard-store";
import { createDashboardOperations } from "./operations";

describe("dashboard MCP operations contract", () => {
  test("performs permission-governed settings and data-file work", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "dashboard-mcp-"));
    const configurationPath = join(workspace, "dashboard.json");
    const configuration = {
      ...defaultDashboardConfiguration,
      agentPermissions: {
        configuration: "write" as const,
        data: "write" as const,
        panels: "none" as const,
      },
    };
    await replaceDashboardConfiguration(configurationPath, configuration);
    const operations = createDashboardOperations(workspace);

    await expect(operations.readDashboardSettings()).resolves.toEqual(
      configuration,
    );
    await operations.editDashboardSettings({
      ...configuration,
      theme: "contrast",
    });
    await operations.editDataFile(
      "weather.json",
      '{"temperature":72}\n',
    );

    await expect(operations.readDataFile("weather.json")).resolves.toBe(
      '{"temperature":72}\n',
    );
    await expect(
      operations.editDataFile("../outside.txt", "no"),
    ).rejects.toThrow("data directory");
    expect(JSON.parse(await readFile(configurationPath, "utf8"))).toMatchObject(
      {
        theme: "contrast",
        agentPermissions: configuration.agentPermissions,
      },
    );
  });

  test("refreshes the selected saved Calendar integration", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "calendar-mcp-"));
    const configurationPath = join(workspace, "dashboard.json");
    const dataPath = join(workspace, "retained-calendar.json");
    await replaceDashboardConfiguration(configurationPath, {
      ...defaultDashboardConfiguration,
      integrations: [
        {
          id: "personal-calendar",
          type: "google-calendar",
          settings: { calendarId: "personal" },
        },
        {
          id: "team-calendar",
          type: "google-calendar",
          settings: { calendarId: "team" },
        },
      ],
      agentPermissions: {
        configuration: "none",
        data: "write",
        panels: "none",
      },
    });
    const fetchCalendar = async (url: string) => {
      expect(url).toContain("team");
      return Response.json({ items: [{ id: "event-1" }] });
    };
    const operations = createDashboardOperations(
      workspace,
      {
        tokenProvider: async () => "access-token",
        fetch: fetchCalendar,
      },
      { configurationPath, calendarDataPath: dataPath },
    );

    await expect(operations.refreshSource("team-calendar")).resolves.toEqual({
      items: [{ id: "event-1" }],
    });
    await expect(readFile(dataPath, "utf8")).resolves.toContain("event-1");

    await replaceDashboardConfiguration(configurationPath, {
      ...defaultDashboardConfiguration,
      integrations: [
        {
          id: "team-calendar",
          type: "google-calendar",
          settings: { calendarId: "team" },
        },
      ],
      agentPermissions: {
        configuration: "none",
        data: "read",
        panels: "none",
      },
    });
    await expect(operations.refreshSource("team-calendar")).rejects.toThrow(
      "permission",
    );
  });

  test("rejects an unknown source without changing retained data", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "unknown-source-mcp-"));
    const configurationPath = join(workspace, "dashboard.json");
    const dataPath = join(workspace, "retained-calendar.json");
    await replaceDashboardConfiguration(configurationPath, {
      ...defaultDashboardConfiguration,
      agentPermissions: {
        configuration: "none",
        data: "write",
        panels: "none",
      },
    });
    await writeFile(dataPath, '{"retained":true}\n');
    const operations = createDashboardOperations(
      workspace,
      {
        tokenProvider: async () => {
          throw new Error("token provider should not run");
        },
        fetch: async () => {
          throw new Error("fetch should not run");
        },
      },
      { configurationPath, calendarDataPath: dataPath },
    );

    await expect(operations.refreshSource("missing")).rejects.toThrow(
      "Unknown source ID: missing",
    );
    await expect(readFile(dataPath, "utf8")).resolves.toBe(
      '{"retained":true}\n',
    );
  });

  test("rejects an unsupported integration type without changing retained data", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "unsupported-source-mcp-"));
    const configurationPath = join(workspace, "dashboard.json");
    const dataPath = join(workspace, "retained-source.json");
    await replaceDashboardConfiguration(configurationPath, {
      ...defaultDashboardConfiguration,
      integrations: [{ id: "notes", type: "notes", settings: {} }],
      agentPermissions: {
        configuration: "none",
        data: "write",
        panels: "none",
      },
    });
    await writeFile(dataPath, '{"retained":true}\n');
    const operations = createDashboardOperations(
      workspace,
      {
        tokenProvider: async () => {
          throw new Error("token provider should not run");
        },
        fetch: async () => {
          throw new Error("fetch should not run");
        },
      },
      { configurationPath, calendarDataPath: dataPath },
    );

    await expect(operations.refreshSource("notes")).rejects.toThrow(
      "Unsupported integration type: notes",
    );
    await expect(readFile(dataPath, "utf8")).resolves.toBe(
      '{"retained":true}\n',
    );
  });

  async function panelWorkspace() {
    const workspace = await mkdtemp(join(tmpdir(), "panel-mcp-"));
    const configurationPath = join(workspace, "dashboard.json");
    await replaceDashboardConfiguration(configurationPath, {
      ...defaultDashboardConfiguration,
      agentPermissions: {
        configuration: "none",
        data: "none",
        panels: "write",
      },
    });
    return {
      workspace,
      configurationPath,
      operations: createDashboardOperations(workspace),
    };
  }

  const schema = JSON.stringify({
    type: "object",
    properties: { temperature: { type: "number" } },
    required: ["temperature"],
  });
  const component =
    "export function Panel({ data }) { return data.temperature; }";

  test("drafts a panel step by step, then adds it", async () => {
    const { workspace, configurationPath, operations } =
      await panelWorkspace();

    await operations.draftSchema("weather", "Weather", ["weather"], schema);
    await operations.draftComponent("weather", component);
    await operations.addPanel("weather");

    await expect(
      readFile(join(workspace, "panels", "weather", "panel.tsx"), "utf8"),
    ).resolves.toBe(component);
    await expect(
      readFile(configurationPath, "utf8").then((contents) =>
        JSON.parse(contents),
      ),
    ).resolves.toMatchObject({
      panels: [{ id: "welcome" }, { id: "weather" }],
      wiring: [{ panelId: "welcome" }, { panelId: "weather" }],
      arrangement: ["welcome", "weather"],
    });
  });

  test("rejects add-panel without a matching draft", async () => {
    const { operations } = await panelWorkspace();
    await expect(operations.addPanel("weather")).rejects.toThrow(
      "No draft found for panel 'weather'",
    );
  });

  test("rejects draft-component before draft-schema", async () => {
    const { operations } = await panelWorkspace();
    await expect(
      operations.draftComponent("weather", component),
    ).rejects.toThrow("draft-component requires draft-schema first");
  });

  test("rejects add-panel for an id that already exists", async () => {
    const { operations } = await panelWorkspace();
    await operations.draftSchema("weather", "Weather", ["weather"], schema);
    await operations.draftComponent("weather", component);
    await operations.addPanel("weather");

    await operations.draftSchema("weather", "Weather", ["weather"], schema);
    await operations.draftComponent("weather", component);
    await expect(operations.addPanel("weather")).rejects.toThrow(
      "Panel 'weather' already exists; use edit-panel",
    );
  });

  test("rejects edit-panel for an id that does not exist", async () => {
    const { operations } = await panelWorkspace();
    await operations.draftSchema("weather", "Weather", ["weather"], schema);
    await operations.draftComponent("weather", component);
    await expect(operations.editPanel("weather")).rejects.toThrow(
      "Panel 'weather' does not exist; use add-panel",
    );
  });

  test("edit-panel replaces in place and can persist after a single draft step", async () => {
    const { workspace, configurationPath, operations } =
      await panelWorkspace();
    await operations.draftSchema("weather", "Weather", ["weather"], schema);
    await operations.draftComponent("weather", component);
    await operations.addPanel("weather");

    const updatedComponent =
      "export function Panel({ data }) { return `${data.temperature}F`; }";
    await operations.draftComponent("weather", updatedComponent);
    await operations.editPanel("weather");

    await expect(
      readFile(join(workspace, "panels", "weather", "panel.tsx"), "utf8"),
    ).resolves.toBe(updatedComponent);
    await expect(
      readFile(join(workspace, "panels", "weather", "schema.json"), "utf8"),
    ).resolves.toContain("temperature");
    await expect(
      readFile(configurationPath, "utf8").then((contents) =>
        JSON.parse(contents),
      ),
    ).resolves.toMatchObject({
      panels: [{ id: "welcome" }, { id: "weather" }],
      arrangement: ["welcome", "weather"],
    });
  });

  test("removes a panel and prunes its wiring and arrangement", async () => {
    const { workspace, configurationPath, operations } =
      await panelWorkspace();
    await operations.draftSchema("weather", "Weather", ["weather"], schema);
    await operations.draftComponent("weather", component);
    await operations.addPanel("weather");

    await operations.removePanel("weather");

    await expect(
      readFile(join(workspace, "panels", "weather", "panel.tsx"), "utf8"),
    ).rejects.toThrow();
    await expect(
      readFile(configurationPath, "utf8").then((contents) =>
        JSON.parse(contents),
      ),
    ).resolves.toMatchObject({
      panels: [{ id: "welcome" }],
      wiring: [{ panelId: "welcome" }],
      arrangement: ["welcome"],
    });
  });

  test("rejects a raw HTML element React Aria Components already covers", async () => {
    const { operations } = await panelWorkspace();
    await operations.draftSchema("weather", "Weather", ["weather"], schema);
    await expect(
      operations.draftComponent(
        "weather",
        "export function Panel() { return <button>Go</button>; }",
      ),
    ).rejects.toThrow("Use React Aria Components' <Button>");
  });

  test("rejects inline style and literal color/size values", async () => {
    const { operations } = await panelWorkspace();
    await operations.draftSchema("weather", "Weather", ["weather"], schema);
    await expect(
      operations.draftComponent(
        "weather",
        "export function Panel() { return <div style={{ color: 'red' }} />; }",
      ),
    ).rejects.toThrow("theme tokens");
    await expect(
      operations.draftComponent(
        "weather",
        "export function Panel() { return <div className=\"#ff0000\" />; }",
      ),
    ).rejects.toThrow("theme tokens");
  });

  test("requires draft-formatter when schema doesn't match refreshed source data", async () => {
    const { workspace, operations } = await panelWorkspace();
    await mkdir(join(workspace, "data"), { recursive: true });
    await writeFile(
      join(workspace, "data", "weather.json"),
      JSON.stringify({ tempF: 72 }),
    );

    await operations.draftSchema("weather", "Weather", ["weather"], schema);
    await operations.draftComponent("weather", component);

    await expect(operations.addPanel("weather")).rejects.toThrow(
      "call draft-formatter to reshape it",
    );
  });

  test("allows committing without a formatter when source data has never been refreshed", async () => {
    const { operations } = await panelWorkspace();
    await operations.draftSchema("weather", "Weather", ["weather"], schema);
    await operations.draftComponent("weather", component);
    await expect(operations.addPanel("weather")).resolves.toBeUndefined();
  });
});
