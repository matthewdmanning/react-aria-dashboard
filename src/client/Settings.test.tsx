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
  agentPermissions: { configuration: "read", data: "none" },
  panels: [{ id: "welcome", title: "Welcome", definition: "message" }],
  wiring: [{ panelId: "welcome", source: "welcome", formatter: "message" }],
  arrangement: ["welcome"],
};

describe("Settings contract", () => {
  test("persists direct settings changes without changing panel configuration", async () => {
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
      panels: configuration.panels,
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
    expect(html).not.toContain("Panel arrangement");
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
