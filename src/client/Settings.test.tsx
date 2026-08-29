import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import type { DashboardConfiguration } from "../dashboard";
import {
  readDashboardConfiguration,
  replaceDashboardConfiguration,
} from "../server/dashboard-store";
import { Settings, saveDashboardSettings } from "./Settings";

const configuration: DashboardConfiguration = {
  version: 1,
  integrations: [],
  theme: "calm",
  fontScale: 1,
  agentPermissions: { configuration: "read", data: "none", cards: "none" },
  cards: [{ id: "welcome", title: "Welcome", definition: "message" }],
  wiring: [{ cardId: "welcome", source: "welcome", formatter: "message" }],
  arrangement: ["welcome"],
  formatterSpecs: {},
};

describe("Settings contract", () => {
  test("persists direct settings changes without changing card configuration", async () => {
    const directory = await mkdtemp(join(tmpdir(), "settings-"));
    const path = join(directory, "dashboard.json");
    await replaceDashboardConfiguration(path, configuration);

    await saveDashboardSettings(
      configuration,
      {
        integrations: [
          {
            id: "calendar",
            type: "google-calendar",
            settings: { calendarId: "team" },
          },
        ],
        theme: "contrast",
        fontScale: 1.25,
        agentPermissions: {
          configuration: "write",
          data: "read",
          cards: "none",
        },
      },
      (candidate) => replaceDashboardConfiguration(path, candidate),
    );

    const reloaded = await readDashboardConfiguration(path);
    expect(reloaded).toMatchObject({
      theme: "contrast",
      fontScale: 1.25,
      integrations: [{ id: "calendar", type: "google-calendar" }],
      agentPermissions: { configuration: "write", data: "read" },
      cards: configuration.cards,
      wiring: configuration.wiring,
      arrangement: configuration.arrangement,
    });
  });

  test("renders only direct settings controls", () => {
    const html = renderToStaticMarkup(
      createElement(Settings, {
        configuration,
        themes: ["calm", "contrast"],
        onSave: async () => undefined,
      }),
    );

    expect(html).toContain("Theme");
    expect(html).toContain("Font scale");
    expect(html).toContain("Integrations");
    expect(html).toContain("Agent permissions");
    expect(html).not.toContain("Card arrangement");
    expect(html).not.toContain("Formatter");
  });

  test("does not persist integration credentials", async () => {
    await expect(
      saveDashboardSettings(
        configuration,
        {
          integrations: [
            {
              id: "calendar",
              type: "google-calendar",
              settings: { accessToken: "private" },
            },
          ],
          theme: "calm",
          fontScale: 1,
          agentPermissions: configuration.agentPermissions,
        },
        async () => undefined,
      ),
    ).rejects.toThrow("credentials");
  });
});
