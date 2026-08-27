import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

import { defaultDashboardConfiguration } from "../dashboard";
import {
  handleDashboardConfigurationRequest,
  handleGoogleCalendarRequest,
} from "./index";

describe("Settings configuration API contract", () => {
  test("saves and reloads configuration through the HTTP interface", async () => {
    const directory = await mkdtemp(join(tmpdir(), "settings-api-"));
    const path = join(directory, "dashboard.json");
    const changed = { ...defaultDashboardConfiguration, theme: "contrast" };

    const saved = await handleDashboardConfigurationRequest(
      new Request("http://dashboard/api/dashboard-configuration", {
        method: "PUT",
        body: JSON.stringify(changed),
      }),
      path,
    );
    const loaded = await handleDashboardConfigurationRequest(
      new Request("http://dashboard/api/dashboard-configuration"),
      path,
    );

    expect(saved.status).toBe(204);
    await expect(loaded.json()).resolves.toEqual(changed);
  });

  test("loads retained data and refreshes through the explicit pull endpoint", async () => {
    const directory = await mkdtemp(join(tmpdir(), "calendar-api-"));
    const configurationPath = join(directory, "dashboard.json");
    const dataPath = join(directory, "google-calendar.json");
    await handleDashboardConfigurationRequest(
      new Request("http://dashboard/api/dashboard-configuration", {
        method: "PUT",
        body: JSON.stringify({
          ...defaultDashboardConfiguration,
          integrations: [
            {
              id: "calendar",
              type: "google-calendar",
              settings: { calendarId: "team" },
            },
          ],
        }),
      }),
      configurationPath,
    );
    const source = { items: [{ id: "event-1", summary: "Planning" }] };

    const refreshed = await handleGoogleCalendarRequest(
      new Request("http://dashboard/api/google-calendar", { method: "POST" }),
      configurationPath,
      dataPath,
      {
        tokenProvider: async () => "access-token",
        fetch: async (url, init) => {
          expect(url).toContain("team");
          expect(init?.headers).toEqual({
            Authorization: "Bearer access-token",
          });
          return Response.json(source);
        },
      },
    );

    expect(refreshed.status).toBe(200);
    await expect(refreshed.json()).resolves.toEqual(source);
    expect(JSON.parse(await readFile(dataPath, "utf8"))).toEqual(source);
    await expect(
      handleGoogleCalendarRequest(
        new Request("http://dashboard/api/google-calendar"),
        configurationPath,
        dataPath,
        { tokenProvider: async () => "unused" },
      ).then((response) => response.json()),
    ).resolves.toEqual(source);
  });
});
