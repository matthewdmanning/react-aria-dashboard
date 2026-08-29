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
        cards: "none" as const,
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
    await operations.editDataFile("weather.json", '{"temperature":72}\n');

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
        cards: "none",
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
        cards: "none",
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
        cards: "none",
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
        cards: "none",
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

  async function cardWorkspace() {
    const workspace = await mkdtemp(join(tmpdir(), "card-mcp-"));
    const configurationPath = join(workspace, "dashboard.json");
    await replaceDashboardConfiguration(configurationPath, {
      ...defaultDashboardConfiguration,
      agentPermissions: {
        configuration: "none",
        data: "none",
        cards: "write",
      },
    });
    return {
      workspace,
      configurationPath,
      operations: createDashboardOperations(workspace),
    };
  }

  async function writeSourceData(workspace: string, id: string, data: unknown) {
    const dataDir = join(workspace, "data");
    await mkdir(dataDir, { recursive: true });
    await writeFile(join(dataDir, `${id}.json`), JSON.stringify(data));
  }

  test("adds a card with identity formatting", async () => {
    const { workspace, configurationPath, operations } = await cardWorkspace();
    await writeSourceData(workspace, "weather", { message: "72 degrees" });

    await operations.addCard({
      id: "weather",
      title: "Weather",
      variant: "message",
      source: "weather",
    });

    await expect(
      readFile(configurationPath, "utf8").then((contents) =>
        JSON.parse(contents),
      ),
    ).resolves.toMatchObject({
      cards: [{ id: "welcome" }, { id: "weather", definition: "message" }],
      wiring: [
        { cardId: "welcome" },
        { cardId: "weather", source: "weather", formatter: "identity" },
      ],
      arrangement: ["welcome", "weather"],
    });
  });

  test("rejects an unknown card variant", async () => {
    const { operations } = await cardWorkspace();
    await expect(
      operations.addCard({
        id: "weather",
        title: "Weather",
        variant: "made-up",
        source: "weather",
      }),
    ).rejects.toThrow("Unknown card variant 'made-up'");
  });

  test("rejects add-card for an id that already exists", async () => {
    const { workspace, operations } = await cardWorkspace();
    await writeSourceData(workspace, "weather", { message: "72 degrees" });
    const args = {
      id: "weather",
      title: "Weather",
      variant: "message",
      source: "weather",
    } as const;
    await operations.addCard(args);

    await expect(operations.addCard(args)).rejects.toThrow(
      "Card 'weather' already exists; use edit-card",
    );
  });

  test("rejects edit-card for an id that does not exist", async () => {
    const { workspace, operations } = await cardWorkspace();
    await writeSourceData(workspace, "weather", { message: "72 degrees" });
    await expect(
      operations.editCard({
        id: "weather",
        title: "Weather",
        variant: "message",
        source: "weather",
      }),
    ).rejects.toThrow("Card 'weather' does not exist; use add-card");
  });

  test("edit-card replaces in place and keeps arrangement position", async () => {
    const { workspace, configurationPath, operations } = await cardWorkspace();
    await writeSourceData(workspace, "weather", { message: "72 degrees" });
    await operations.addCard({
      id: "weather",
      title: "Weather",
      variant: "message",
      source: "weather",
    });

    await operations.editCard({
      id: "weather",
      title: "Weather (updated)",
      variant: "message",
      source: "weather",
    });

    await expect(
      readFile(configurationPath, "utf8").then((contents) =>
        JSON.parse(contents),
      ),
    ).resolves.toMatchObject({
      cards: [{ id: "welcome" }, { id: "weather", title: "Weather (updated)" }],
      arrangement: ["welcome", "weather"],
    });
  });

  test("removes a card and prunes its wiring and arrangement", async () => {
    const { workspace, configurationPath, operations } = await cardWorkspace();
    await writeSourceData(workspace, "weather", { message: "72 degrees" });
    await operations.addCard({
      id: "weather",
      title: "Weather",
      variant: "message",
      source: "weather",
    });

    await operations.removeCard("weather");

    await expect(
      readFile(configurationPath, "utf8").then((contents) =>
        JSON.parse(contents),
      ),
    ).resolves.toMatchObject({
      cards: [{ id: "welcome" }],
      wiring: [{ cardId: "welcome" }],
      arrangement: ["welcome"],
    });
  });

  test("rejects a formatterSpec whose output doesn't match the variant schema", async () => {
    const { workspace, operations } = await cardWorkspace();
    await writeSourceData(workspace, "weather", { tempF: 72 });

    await expect(
      operations.addCard({
        id: "weather",
        title: "Weather",
        variant: "message",
        source: "weather",
        formatterSpec: {
          shape: "object",
          fields: { wrongField: { from: ["tempF"], coerce: "string" } },
        },
      }),
    ).rejects.toThrow("does not match the 'message' card schema");
  });

  test("accepts a formatterSpec that reshapes source data to match the variant schema", async () => {
    const { workspace, configurationPath, operations } = await cardWorkspace();
    await writeSourceData(workspace, "weather", { tempF: 72 });

    await operations.addCard({
      id: "weather",
      title: "Weather",
      variant: "message",
      source: "weather",
      formatterSpec: {
        shape: "object",
        fields: { message: { from: ["tempF"], coerce: "string" } },
      },
    });

    await expect(
      readFile(configurationPath, "utf8").then((contents) =>
        JSON.parse(contents),
      ),
    ).resolves.toMatchObject({
      wiring: [
        { cardId: "welcome" },
        { cardId: "weather", formatter: "weather" },
      ],
      formatterSpecs: {
        weather: {
          shape: "object",
          fields: { message: { from: ["tempF"], coerce: "string" } },
        },
      },
    });
  });

  test("allows adding a card when source data has never been written", async () => {
    const { operations } = await cardWorkspace();
    await expect(
      operations.addCard({
        id: "weather",
        title: "Weather",
        variant: "message",
        source: "weather",
      }),
    ).resolves.toBeUndefined();
  });
});
